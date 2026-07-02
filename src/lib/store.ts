import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  get as idbGet,
  set as idbSet,
  del as idbDel,
  clear as idbClear,
} from 'idb-keyval';
import type {
  ModuleData,
  PracticumSchedule,
  UserProfile,
  ReportSession,
  CopilotMessage,
} from '@/lib/types';
import { DEFAULT_COPILOT_SETTINGS, type CopilotSettings } from '@/lib/copilot/types';

// Re-export domain types for backwards compatibility with existing consumers
// that import them from `@/lib/store`. Canonical definitions live in
// `@/lib/types`.
export type { ModuleData, PracticumSchedule, UserProfile, ReportSession };

/**
 * Default welcome message seeded into a session's `chatHistory` on first
 * hydration when it is missing or empty (Req 1.5). Exported so callers
 * (the migrator, the read-time `hydrateSession` helper, and the
 * `useCopilotAI` hook in task 4.1) share one source of truth instead of
 * duplicating the literal.
 */
export const WELCOME_MESSAGE: CopilotMessage = {
  role: 'agent',
  text:
    'Halo! Saya AI Report Generator Copilot. Silakan isi data praktikum di tab "Settings", lalu klik "Generate" atau perintahkan saya untuk membuat maupun mengedit laporan!',
};

/**
 * Pure migration logic for the persisted Zustand record. Extracted from
 * the inline `persist({ migrate })` config so unit tests can call it
 * directly without instantiating the full store.
 *
 * Handles `0 → 2` and `1 → 2` transitions:
 *  - v0 cleanup: strip the legacy default `mataPraktikumList` entries.
 *  - v1 → v2 seed: top-level `copilotSettings` plus the eight Copilot
 *    agent-upgrade fields on every session (Req 9.3).
 *
 * Mutates and returns `state` for the same reasons Zustand's own
 * `migrate` callback does — the persist middleware hands us a
 * recently-deserialized POJO with no other observers.
 */
export function migratePersistedState(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any,
  fromVersion: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // Existing v0 cleanup preserved verbatim.
  if (fromVersion === 0) {
    if (state.mataPraktikumList) {
      const oldDefaults = [
        'Pemrograman Berorientasi Objek',
        'Basis Data',
        'Struktur Data',
        'Jaringan Komputer',
        'Kecerdasan Buatan',
      ];
      state.mataPraktikumList = state.mataPraktikumList.filter(
        (mk: string) => !oldDefaults.includes(mk),
      );
    }
  }

  // v1 → v2: seed Copilot agent upgrade fields. The defaults const is
  // cloned so the migrator (and any consumer) may mutate freely without
  // mutating the shared module-level reference.
  if (fromVersion < 2) {
    state.copilotSettings ??= { ...DEFAULT_COPILOT_SETTINGS };
    if (Array.isArray(state.sessions)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.sessions = state.sessions.map((s: any) => ({
        ...s,
        chatHistory: s.chatHistory ?? [],
        checkpoints: s.checkpoints ?? [],
        loopCursor: s.loopCursor ?? null,
        runState: s.runState ?? 'idle',
        pendingMerge: s.pendingMerge ?? null,
        taskPlan: s.taskPlan ?? null,
        pendingUserSteer: s.pendingUserSteer ?? null,
        pendingClarification: s.pendingClarification ?? null,
      }));
    }
  }

  // v2 → v3: seed `chatThreads` (per-report archived threads).
  if (fromVersion < 3) {
    if (Array.isArray(state.sessions)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.sessions = state.sessions.map((s: any) => ({
        ...s,
        chatThreads: s.chatThreads ?? [],
      }));
    }
  }

  return state;
}

/**
 * Defense-in-depth defaulting helper for sessions read from storage.
 *
 * Returns a NEW session object with every Copilot-upgrade optional field
 * populated. Intentionally does NOT save back to the store: the next
 * natural save persists the defaulted shape (Req 1.5 — "without
 * modifying the persisted record until the next save").
 *
 * Used at UI read time so that even if a session bypassed the migrator
 * (e.g. a v1 backup imported via `replaceFromBackup` before the
 * persist-version bump landed), downstream consumers always see fully
 * populated fields.
 *
 * If `chatHistory` is missing OR empty, seeds `[WELCOME_MESSAGE]`. Pure:
 * never mutates `s`.
 */
export function hydrateSession(s: ReportSession): ReportSession {
  const existingChat = s.chatHistory;
  const chatHistory =
    !existingChat || existingChat.length === 0 ? [WELCOME_MESSAGE] : existingChat;
  return {
    ...s,
    chatHistory,
    chatThreads: s.chatThreads ?? [],
    checkpoints: s.checkpoints ?? [],
    loopCursor: s.loopCursor ?? null,
    runState: s.runState ?? 'idle',
    pendingMerge: s.pendingMerge ?? null,
    taskPlan: s.taskPlan ?? null,
    pendingUserSteer: s.pendingUserSteer ?? null,
    pendingClarification: s.pendingClarification ?? null,
  };
}

interface AppState {
  profile: UserProfile;
  setProfile: (profile: Partial<UserProfile>) => void;
  
  mataPraktikumList: string[];
  addMataPraktikum: (mk: string) => void;
  removeMataPraktikum: (mk: string) => void;
  
  schedules: PracticumSchedule[];
  setSchedules: (schedules: PracticumSchedule[]) => void;
  updateSchedule: (id: string, updated: Partial<PracticumSchedule>) => void;
  
  isCopilotOpen: boolean;
  toggleCopilot: () => void;
  
  isOptionsOpen: boolean;
  setOptionsOpen: (isOpen: boolean) => void;
  clearAllData: () => Promise<void>;
  /** Replace every persisted slice with the imported payload, then reload. */
  replaceFromBackup: (payload: import('@/lib/backup').BackupPayload) => Promise<void>;
  
  sessions: ReportSession[];
  
  activeTab: string; // 'home' or session.id
  setActiveTab: (tabId: string) => void;
  
  openTabs: { id: string; title: string; type: 'home' | 'session' }[];
  openSessionTab: (session: ReportSession) => void;
  closeTab: (tabId: string) => void;

  saveSession: (session: ReportSession) => void;
  deleteSession: (sessionId: string) => void;
  deleteAllSessions: () => void;
  createNewSession: () => ReportSession;
  
  manualProgress: Record<string, number[]>;
  toggleManualProgress: (subject: string, pertemuan: number) => void;
  
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  globalFileNameFormat: string;
  setGlobalFileNameFormat: (format: string) => void;
  autoFetchColab: boolean;
  setAutoFetchColab: (val: boolean) => void;

  /** Last-selected Gemini model display name. Persisted across reloads. */
  selectedModelName: string;
  setSelectedModelName: (name: string) => void;

  /**
   * App-wide Copilot settings (Req 10). Persisted at the top level of
   * the store rather than per-session because every session shares the
   * same agent capabilities (auto-accept, search grounding, code
   * execution, max iterations). Initialized from
   * `DEFAULT_COPILOT_SETTINGS` on a fresh store; the v1 → v2 migrator
   * seeds the same defaults for legacy persisted records.
   */
  copilotSettings: CopilotSettings;

  /**
   * Selection-aware editing context: when the user highlights text in
   * the report preview, the next composer message scopes the AI's
   * edit to that selection. Cleared after the message is dispatched
   * or when the user clicks the chip's ✕. Not persisted — it's a
   * transient UI state, refreshing the page should reset it.
   */
  selectionContext: { text: string; field?: string } | null;
  setSelectionContext: (ctx: { text: string; field?: string } | null) => void;
  /**
   * Shallow-merge `patch` into `copilotSettings`. The setter is the only
   * write path so it's where the `maxIterations: [1, 30]` clamp lives —
   * this protects the slice from a slider component (or future external
   * caller) sending an out-of-range value.
   */
  setCopilotSettings: (patch: Partial<CopilotSettings>) => void;

  /**
   * Hydration gate (Req 11). Starts `false`. Flipped to `true` exactly
   * once when Zustand's `persist` middleware finishes reading from IDB
   * (or after the no-record / corrupted-record fallback paths fire).
   *
   * Components gate any data-bound rendering on `hasHydrated === true`
   * so users never see the empty-state flash ("No schedules yet / No
   * reports yet") during the IDB read window. Not persisted — must
   * reset to `false` on every page load until rehydration completes.
   */
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
}

const DEFAULT_MK_LIST: string[] = [];

// Custom storage for Zustand using idb-keyval. Wrapped with
// `performance.mark` / `performance.measure` so a regression in
// hydration time is detectable from devtools without code changes.
// The instrumentation has zero observable effect — it just emits
// performance entries and one `console.info` line on first read.
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof performance !== 'undefined') {
      performance.mark('hydrate.idb-read.start');
    }
    const raw = (await idbGet(name)) || null;
    if (typeof performance !== 'undefined') {
      performance.mark('hydrate.idb-read.end');
      try {
        performance.measure(
          'hydrate.idb-read',
          'hydrate.idb-read.start',
          'hydrate.idb-read.end',
        );
      } catch {
        // measure can throw if a mark already moved past; never fatal.
      }
      const measure = performance.getEntriesByName('hydrate.idb-read').pop();
      const bytes = raw ? raw.length : 0;
      // eslint-disable-next-line no-console
      console.info(
        `[boot] idb-read=${Math.round(measure?.duration ?? 0)}ms payload-bytes=${bytes}`,
      );
      // Soft warning when the persisted blob crosses 5MB — at this
      // size every reload pays a noticeable parse cost. We never
      // delete user data automatically (Req 11.11).
      if (bytes > 5_000_000) {
        // eslint-disable-next-line no-console
        console.warn(
          `[boot] persisted payload is ${(bytes / 1_000_000).toFixed(1)}MB — consider exporting a backup and clearing old sessions.`,
        );
      }
    }
    return raw;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await idbSet(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await idbDel(name);
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: { nama: '', nim: '' },
      setProfile: (profile) => set((state) => ({ profile: { ...state.profile, ...profile } })),
      
      mataPraktikumList: DEFAULT_MK_LIST,
      addMataPraktikum: (mk) => set((state) => {
        if (!state.mataPraktikumList.includes(mk) && mk.trim() !== '') {
          return { mataPraktikumList: [...state.mataPraktikumList, mk.trim()] };
        }
        return state;
      }),
      removeMataPraktikum: (mk) => set((state) => {
        return { mataPraktikumList: state.mataPraktikumList.filter(item => item !== mk) };
      }),

      schedules: [],
      setSchedules: (schedules) => set({ schedules }),
      updateSchedule: (id, updated) => set((state) => ({
        schedules: state.schedules.map(s => s.id === id ? { ...s, ...updated } : s)
      })),

      isCopilotOpen: false,
      toggleCopilot: () => set((state) => ({ isCopilotOpen: !state.isCopilotOpen })),
      
      isOptionsOpen: false,
      setOptionsOpen: (isOpen) => set({ isOptionsOpen: isOpen }),
      clearAllData: async () => {
        await idbClear();
        window.location.reload();
      },
      replaceFromBackup: async (payload) => {
        // Migrating to a new browser via the Backup tab.
        //
        // We deliberately bypass Zustand's `persist` middleware here and
        // write the IDB record directly. Reasons:
        //  1. The persist middleware queues writes asynchronously with no
        //     synchronous flush primitive. With multi-megabyte sessions
        //     (notebook content + base64 images), the IDB write can take
        //     seconds — far longer than any setTimeout we'd guess.
        //  2. We reload the page immediately afterwards anyway, so the
        //     in-memory Zustand state never matters.
        //
        // The shape we write is exactly what `persist` expects to find on
        // the next boot: `{ state: <full state>, version: <persist version> }`
        // serialized as JSON, stored under the persist key.
        //
        // No race with autosave: this action runs from the modal-confirm
        // click, by which point the user has stopped editing for at least
        // long enough to pick a file and review the staged summary. Any
        // pending persist write has already flushed.
        //
        // TODO(task 7.1 — Phase A verification): integration coverage for
        // this branch lives in the Phase A smoke test; unit-testing it
        // here without a real Zustand instance is awkward and low value
        // compared to the full reload-and-rehydrate round trip.
        const current = get();
        const nextState = {
          profile: payload.profile,
          mataPraktikumList: payload.mataPraktikumList ?? [],
          schedules: payload.schedules ?? [],
          sessions: payload.sessions ?? [],
          manualProgress: payload.manualProgress ?? {},
          globalFileNameFormat:
            payload.globalFileNameFormat ?? '{nim}_{nama}_{pertemuan}_{matkul}',
          // Preserve the local API key unless the backup explicitly carried one.
          geminiApiKey: payload.geminiApiKey ?? current.geminiApiKey,
          // Seed Copilot settings from the backup if present, otherwise the
          // defaults — the BackupPayload predates `copilotSettings` so most
          // imports will land in the `?? { ...DEFAULT }` branch and the
          // migrator running on next boot will be a no-op for this slice.
          copilotSettings:
            (payload as { copilotSettings?: typeof DEFAULT_COPILOT_SETTINGS })
              .copilotSettings ?? { ...DEFAULT_COPILOT_SETTINGS },
          // UI state — reset so the user lands on a clean Home tab.
          activeTab: 'home',
          openTabs: [{ id: 'home', title: 'Home', type: 'home' as const }],
          isCopilotOpen: false,
          isOptionsOpen: false,
        };

        // Stringify can be expensive on multi-MB payloads but is unavoidable;
        // the persist middleware does the same thing internally.
        const idbRecord = JSON.stringify({ state: nextState, version: 2 });

        // Direct, awaited write — no race with the persist middleware.
        await idbSet('report-generator-storage', idbRecord);

        // Reload picks up the freshly-written record on next boot.
        window.location.reload();
      },
      
      sessions: [],
      
      activeTab: 'home',
      setActiveTab: (tabId) => set({ activeTab: tabId }),
      
      openTabs: [{ id: 'home', title: 'Home', type: 'home' }],
      
      openSessionTab: (session) => {
        set((state) => {
          const tabExists = state.openTabs.some(t => t.id === session.id);
          const newTabs = tabExists 
            ? state.openTabs 
            : [...state.openTabs, { id: session.id, title: session.title || 'New Report', type: 'session' as const }];
            
          return {
            openTabs: newTabs,
            activeTab: session.id
          };
        });
      },
      
      closeTab: (tabId) => {
        set((state) => {
          const newTabs = state.openTabs.filter(t => t.id !== tabId);
          let newActiveTab = state.activeTab;
          if (state.activeTab === tabId) {
            newActiveTab = newTabs[newTabs.length - 1]?.id || 'home';
          }
          if (newTabs.length === 0) {
            newTabs.push({ id: 'home', title: 'Home', type: 'home' as const });
            newActiveTab = 'home';
          }
          return {
            openTabs: newTabs,
            activeTab: newActiveTab
          };
        });
      },
      
      saveSession: (session) => {
        set((state) => {
          const i = state.sessions.findIndex(s => s.id === session.id);
          const newTitle = session.metadata.judulPertemuan || session.metadata.mataPraktikum || 'Untitled Report';
          const sessionWithTitle = { ...session, title: newTitle, updatedAt: Date.now() };
          const newSessions = [...state.sessions];
          
          if (i >= 0) {
            newSessions[i] = sessionWithTitle;
          } else {
            newSessions.push(sessionWithTitle);
          }
          
          // Also update title in openTabs if changed
          const newTabs = state.openTabs.map(t => 
            t.id === session.id ? { ...t, title: sessionWithTitle.title } : t
          );
          
          return { sessions: newSessions, openTabs: newTabs };
        });
      },
      
      deleteSession: (sessionId) => {
        const currentActiveTab = get().activeTab;
        const currentSessions = get().sessions;
        const currentOpenTabs = get().openTabs;

        const nextSessions = currentSessions.filter(s => s.id !== sessionId);
        const nextTabs = currentOpenTabs.filter(t => t.id !== sessionId);
        
        let nextActiveTab = currentActiveTab;
        if (currentActiveTab === sessionId) {
          nextActiveTab = nextTabs[nextTabs.length - 1]?.id || 'home';
        }
        
        if (nextTabs.length === 0) {
          nextTabs.push({ id: 'home', title: 'Home', type: 'home' as const });
          nextActiveTab = 'home';
        }

        set({
          sessions: nextSessions,
          openTabs: nextTabs,
          activeTab: nextActiveTab
        });
      },
      
      deleteAllSessions: () => {
        set({
          sessions: [],
          openTabs: [{ id: 'home', title: 'Home', type: 'home' as const }],
          activeTab: 'home'
        });
      },
      
      createNewSession: () => {
        const id = crypto.randomUUID();
        const newSession: ReportSession = {
          id,
          title: 'New Report',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {
            reportType: 'praktikum',
            mataPraktikum: '',
            judulPertemuan: '',
            hariTanggalSesi: '',
            laboratorium: '',
            dosen: '',
          },
          preTest: '',
          modulContext: '',
          postTest: '',
        };
        const state = get();
        state.saveSession(newSession);
        state.openSessionTab(newSession);
        return newSession;
      },
      
      manualProgress: {},
      toggleManualProgress: (subject, pertemuan) => {
        set((state) => {
          const currentProgress = state.manualProgress[subject] || [];
          const isDone = currentProgress.includes(pertemuan);
          const newProgress = isDone 
            ? currentProgress.filter(p => p !== pertemuan)
            : [...currentProgress, pertemuan];
            
          return {
            manualProgress: {
              ...state.manualProgress,
              [subject]: newProgress
            }
          };
        });
      },
      
      geminiApiKey: '',
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      
      globalFileNameFormat: '{nim}_{nama}_{pertemuan}_{matkul}',
      setGlobalFileNameFormat: (format) => set({ globalFileNameFormat: format }),

      autoFetchColab: true,
      setAutoFetchColab: (val) => set({ autoFetchColab: val }),

      // App-wide last-selected Gemini model. Persisted top-level so a
      // page reload restores the user's pick (Req: model selection
      // should survive refresh). Default mirrors `AVAILABLE_MODELS[1]`
      // ("Gemini 3.1 Pro Preview"). The setter accepts any string —
      // if a model name is removed in a future schema update, the
      // dropdown falls back to the default at read time.
      selectedModelName: 'Gemini 3.1 Pro Preview',
      setSelectedModelName: (name) => set({ selectedModelName: name }),

      // Spread the defaults so the store owns its own object — mutating
      // the slice (or future devtools introspection) never touches the
      // shared module-level constant.
      copilotSettings: { ...DEFAULT_COPILOT_SETTINGS },
      setCopilotSettings: (patch) => set((state) => {
        const next: CopilotSettings = { ...state.copilotSettings, ...patch };
        // Clamp only when the caller supplied a new value; leaving the
        // existing (already-valid) value alone means a no-op patch like
        // `{ autoAccept: false }` doesn't accidentally re-clamp and
        // potentially repair a corrupted slice silently.
        if (patch.maxIterations !== undefined) {
          next.maxIterations = Math.max(1, Math.min(30, patch.maxIterations));
        }
        return { copilotSettings: next };
      }),

      // Selection-aware editing — transient (not persisted via partialize).
      selectionContext: null,
      setSelectionContext: (ctx) => set({ selectionContext: ctx }),

      // Hydration gate (Req 11). Starts false; flipped by the
      // `onRehydrateStorage` lifecycle below.
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: 'report-generator-storage',
      storage: createJSONStorage(() => idbStorage),
      version: 3,
      migrate: (persistedState: unknown, version: number) =>
        migratePersistedState(persistedState, version),
      // Only persist what genuinely needs to survive a reload.
      //
      // Persisted: profile/sessions/schedules + UI state that the
      // user expects to find restored (open tabs, active tab,
      // copilot drawer state).
      // Excluded (transient): selection chip, hydration gate, the
      // options modal flag — these reset to safe defaults on each
      // boot and don't belong in the IDB blob.
      partialize: (state) => ({
        profile: state.profile,
        mataPraktikumList: state.mataPraktikumList,
        schedules: state.schedules,
        sessions: state.sessions,
        manualProgress: state.manualProgress,
        geminiApiKey: state.geminiApiKey,
        globalFileNameFormat: state.globalFileNameFormat,
        autoFetchColab: state.autoFetchColab,
        selectedModelName: state.selectedModelName,
        copilotSettings: state.copilotSettings,
        // Tab persistence — refreshing the page must keep open tabs
        // visible. Without these slices the user lands on Home with
        // every previous tab gone.
        activeTab: state.activeTab,
        openTabs: state.openTabs,
        isCopilotOpen: state.isCopilotOpen,
      }),
      // Flip `hasHydrated` exactly once when the IDB read resolves.
      // Both the success and error paths must flip it so the UI
      // unblocks even when storage is unavailable (Req 11.14, 11.15).
      onRehydrateStorage: () => {
        if (typeof performance !== 'undefined') {
          performance.mark('hydrate.start');
        }
        return (_state, error) => {
          if (typeof performance !== 'undefined') {
            performance.mark('hydrate.end');
            try {
              performance.measure('hydrate.total', 'hydrate.start', 'hydrate.end');
            } catch {
              /* ignore measure-after-clear races */
            }
            const measure = performance.getEntriesByName('hydrate.total').pop();
            // eslint-disable-next-line no-console
            console.info(
              `[boot] hydrate.total=${Math.round(measure?.duration ?? 0)}ms`,
            );
          }
          if (error) {
            // Storage unavailable / corrupted record. Surface a toast
            // via the `sonner` global that's mounted in <App />. We
            // can't import `toast` at module load (circular), so we
            // dispatch a custom event and let a listener in <AppMain />
            // turn it into a toast.
            // eslint-disable-next-line no-console
            console.error('[boot] hydration failed:', error);
            window.dispatchEvent(
              new CustomEvent('boot:hydration-failed', {
                detail: { message: String(error) },
              }),
            );
          } else {
            // Sanity-check the restored UI state. If `activeTab`
            // points to a session that no longer exists (e.g. user
            // deleted it from another window), or `openTabs` is
            // missing the Home tab, repair the slice in-place
            // before flipping the gate so the user lands on a
            // valid view rather than an empty document area.
            const s = useAppStore.getState();
            const validIds = new Set<string>(['home', ...s.sessions.map((x) => x.id)]);
            let openTabs = s.openTabs ?? [];
            if (!openTabs.some((t) => t.id === 'home')) {
              openTabs = [{ id: 'home', title: 'Home', type: 'home' }, ...openTabs];
            }
            // Drop tabs whose backing session was deleted, but keep
            // Home and refresh titles for any session whose title
            // changed since the last save.
            openTabs = openTabs
              .filter((t) => validIds.has(t.id))
              .map((t) => {
                if (t.type === 'home') return t;
                const sess = s.sessions.find((x) => x.id === t.id);
                return sess ? { ...t, title: sess.title || t.title } : t;
              });
            const activeTab = validIds.has(s.activeTab) ? s.activeTab : 'home';
            if (
              openTabs !== s.openTabs ||
              activeTab !== s.activeTab
            ) {
              useAppStore.setState({ openTabs, activeTab });
            }
          }
          // Flip the gate. Even on error: a half-broken in-memory
          // store beats an indefinite skeleton.
          useAppStore.setState({ hasHydrated: true });
        };
      },
    }
  )
);


// Safety net: if hydration somehow doesn't resolve within 5 seconds
// (browser-level IDB quota stalls have been observed), flip the gate
// anyway so the app becomes usable rather than stuck on the skeleton.
// onRehydrateStorage's success path will still fire later; the second
// flip is a no-op.
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (!useAppStore.getState().hasHydrated) {
      // eslint-disable-next-line no-console
      console.warn('[boot] hydration safety-net firing after 5000ms');
      useAppStore.setState({ hasHydrated: true });
    }
  }, 5000);
}
