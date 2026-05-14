// This module is a thin re-export so `@/lib/docx/*` internals can write
// `import type { ReportMetadata } from './types'` without reaching back
// across the barrel. The canonical definitions live in `@/lib/types`.
export type {
  ReportMetadata,
  AIReportData,
  UserImage,
  CellAnalysis,
  QAPair,
  ReportType,
  SessionMetadata,
} from '@/lib/types';
