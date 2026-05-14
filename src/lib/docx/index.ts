/**
 * Public entry point for the DOCX report builder.
 *
 * All callers outside `@/lib/docx` should import from this barrel. The
 * internal modules (`builder.ts`, `sections/*`, `image.ts`, `markdown.ts`,
 * etc.) are implementation details and may be reorganized freely.
 *
 * Type-only imports are safe at top level. Runtime imports of the builder
 * trigger the full docx module graph, which includes the heavy `docx` npm
 * dependency — use dynamic `import('@/lib/docx')` in any path that does
 * not need to generate a document synchronously.
 */

export { generateDocx } from './builder';
export type {
  ReportMetadata,
  AIReportData,
  UserImage,
  CellAnalysis,
  QAPair,
} from '@/lib/types';
