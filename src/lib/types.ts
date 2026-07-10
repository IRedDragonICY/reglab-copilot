/**
 * Single source of truth for domain types used across the Reglab Copilot
 * codebase. Nothing in this file is React-specific. Consumers import from
 * `@/lib/types` (and the `@/lib/docx` barrel re-exports the subset relevant
 * to the document builder).
 *
 * Persistence contract: the shape of `ReportSession` and its nested
 * `SessionMetadata` are frozen. Fields may be added (optional only); never
 * renamed, never removed. The Zustand persistence key
 * `report-generator-storage` stores this shape directly and existing user
 * IndexedDB payloads must continue to deserialize without migration.
 */

import type {
  CopilotMessage,
  Checkpoint,
  ChatThread,
  LoopCursor,
  RunState,
  PendingMerge,
  TaskPlan,
} from '@/lib/copilot/types';

// Re-export Copilot domain types from the canonical session module so
// downstream consumers can `import type { Checkpoint } from '@/lib/types'`
// without reaching into `@/lib/copilot/types` and risking circular imports.
export type {
  CopilotMessage,
  Checkpoint,
  ChatThread,
  LoopCursor,
  RunState,
  PendingMerge,
  TaskPlan,
  TaskPlanStep,
  TaskStatus,
  CopilotSettings,
} from '@/lib/copilot/types';

export interface UserProfile {
  nama: string;
  nim: string;
}

export interface UserImage {
  id: string;
  dataUrl: string;
}

export type ReportType = 'praktikum' | 'kuliah';

/**
 * Session-local metadata as persisted by Zustand.
 */
export interface SessionMetadata {
  reportType?: ReportType;
  mataPraktikum: string;
  judulPertemuan: string;
  hariTanggalSesi: string;
  laboratorium?: string;
  dosen?: string;
  pertemuan?: number;
}

/**
 * Expanded metadata passed to the docx builder: session metadata plus the
 * author's identity. Structurally a superset of `SessionMetadata`; no field
 * renames.
 */
export interface ReportMetadata extends SessionMetadata {
  nama: string;
  nim: string;
}

export interface CellAnalysis {
  notebookIndex?: number;
  cellIndex?: number;
  imageCategory?: string;
  imageIndex?: number;
  section: 'implementasi' | 'post_test';
  caption: string;
  explanation: string;
  tableCaption?: string;
}

export interface QAPair {
  q: string;
  a: string;
}

export interface ConclusionParagraph {
  teks: string;
  imageIndex?: number;
  caption?: string;
}

export interface AIReportData {
  pendahuluan?: string;
  preTestAnswers: QAPair[];
  postTestAnswers: QAPair[];
  stepByStepNarrative: string;
  codeAnalysis: string | ConclusionParagraph[];
  alatDanBahan?: string[];
  cellAnalyses?: CellAnalysis[];
  ulasanPraktikum?: string;
}

export interface ModuleEntry {
  judul: string;
  langkah: string;
  pre_test?: string;
  post_test?: string;
  config?: {
    includePreTest: boolean;
    includeLangkah: boolean;
    includePostTest: boolean;
  };
}

export type ModuleData = Record<number, ModuleEntry>;

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

export function getFormattedJudulPertemuan(metadata: Pick<SessionMetadata, 'reportType' | 'judulPertemuan' | 'pertemuan'>): string {
  if (metadata.reportType === 'kuliah') {
    return metadata.judulPertemuan || '[Topik Kajian]';
  }
  const rawJudul = metadata.judulPertemuan;
  if (!rawJudul) {
    return metadata.pertemuan ? `Pertemuan ke-${metadata.pertemuan}: [Judul Pertemuan]` : '[Judul Pertemuan]';
  }
  
  if (rawJudul.toLowerCase().includes('pertemuan')) {
    return rawJudul;
  }
  
  if (metadata.pertemuan) {
    return `Pertemuan ke-${metadata.pertemuan}: ${rawJudul}`;
  }
  
  return rawJudul;
}

export interface ReportSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  metadata: SessionMetadata;
  files?: { name: string; content: string }[];
  preTestImages?: UserImage[];
  implImages?: UserImage[];
  postTestImages?: UserImage[];
  preTest: string;
  modulContext: string;
  postTest: string;
  ulasanPraktikum?: string;
  aiData?: AIReportData;
  // ---------------------------------------------------------------------------
  // Copilot agent upgrade — purely additive optional fields.
  // Every field below is optional so legacy IndexedDB payloads continue to
  // deserialize without migration. See design.md "Persistence" and
  // requirements.md Req 9.2 (no rename / no remove).
  // ---------------------------------------------------------------------------
  /** Persisted Copilot chat transcript for this session (Req 1). */
  chatHistory?: CopilotMessage[];
  /**
   * Archived chat threads for this session. The live thread is
   * `chatHistory`; "New chat" archives the live thread here before
   * resetting. Per-report history (like Cursor's per-project chat
   * list) — never mixed with threads from other reports.
   */
  chatThreads?: ChatThread[];
  /** Auto + manual snapshots used by Revert / Continue (Req 4). */
  checkpoints?: Checkpoint[];
  /** Resume state for a paused or interrupted Agent_Loop (Req 3). */
  loopCursor?: LoopCursor | null;
  /** Lifecycle of the Agent_Loop driving this session. */
  runState?: RunState;
  /** Computed-but-not-applied merge awaiting review when Auto_Accept is OFF (Req 5.4). */
  pendingMerge?: PendingMerge | null;
  /** Declared task plan from `set_task_plan` / `update_task_status` (Req 6.2, 7.5). */
  taskPlan?: TaskPlan | null;
  /** Free-text steer the user wants the next iteration to honor (Req 11). */
  pendingUserSteer?: string | null;
  /** Atomic clarification block: a question awaiting a user reply (Req 6.4). */
  pendingClarification?: { question: string; askedAt: number } | null;
}
