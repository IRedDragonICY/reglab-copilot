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
} from '@/lib/types';

// Re-export domain types for backwards compatibility with existing consumers
// that import them from `@/lib/store`. Canonical definitions live in
// `@/lib/types`.
export type { ModuleData, PracticumSchedule, UserProfile, ReportSession };

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
}

const DEFAULT_MK_LIST: string[] = [];

// Custom storage for Zustand using idb-keyval
const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await idbGet(name)) || null;
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
          // UI state — reset so the user lands on a clean Home tab.
          activeTab: 'home',
          openTabs: [{ id: 'home', title: 'Home', type: 'home' as const }],
          isCopilotOpen: false,
          isOptionsOpen: false,
        };

        // Stringify can be expensive on multi-MB payloads but is unavoidable;
        // the persist middleware does the same thing internally.
        const idbRecord = JSON.stringify({ state: nextState, version: 1 });

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
      setGlobalFileNameFormat: (format) => set({ globalFileNameFormat: format })
    }),
    {
      name: 'report-generator-storage',
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          if (persistedState.mataPraktikumList) {
            const oldDefaults = [
              'Pemrograman Berorientasi Objek',
              'Basis Data',
              'Struktur Data',
              'Jaringan Komputer',
              'Kecerdasan Buatan',
            ];
            persistedState.mataPraktikumList = persistedState.mataPraktikumList.filter(
              (mk: string) => !oldDefaults.includes(mk)
            );
          }
        }
        return persistedState;
      },
    }
  )
);

