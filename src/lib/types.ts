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

export interface AIReportData {
  pendahuluan?: string;
  preTestAnswers: QAPair[];
  postTestAnswers: QAPair[];
  stepByStepNarrative: string;
  codeAnalysis: string;
  alatDanBahan?: string[];
  cellAnalyses?: CellAnalysis[];
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
  aiData?: AIReportData;
}
