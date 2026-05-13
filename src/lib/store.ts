import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del, clear } from 'idb-keyval';

export type ModuleData = Record<number, { 
  judul: string; 
  langkah: string; 
  pre_test?: string; 
  post_test?: string;
  config?: { includePreTest: boolean; includeLangkah: boolean; includePostTest: boolean };
}>;

export interface PracticumSchedule {
  id: string;
  mataPraktikum: string;
  laboratorium: string;
  dosen: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  customDates?: Record<number, string>;
  moduleData?: ModuleData;
  pdfBase64?: string;
  pdfFileName?: string;
  fileNameFormat?: string;
}

export interface UserProfile {
  nama: string;
  nim: string;
}

export interface ReportSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata: {
    reportType?: 'praktikum' | 'kuliah';
    mataPraktikum: string;
    judulPertemuan: string;
    hariTanggalSesi: string;
    laboratorium?: string;
    dosen?: string;
    pertemuan?: number;
  };
  files?: {
    name: string;
    content: string;
  }[];
  preTestImages?: {id: string, dataUrl: string}[];
  implImages?: {id: string, dataUrl: string}[];
  postTestImages?: {id: string, dataUrl: string}[];
  
  preTest: string;
  modulContext: string;
  postTest: string;
  aiData?: any;
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
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
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
        await clear();
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

