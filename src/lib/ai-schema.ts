/**
 * Back-compat shim. The canonical declarations moved to `@/lib/ai/schema`
 * when the AI module was hoisted into `@/lib/ai/` during task 6.
 *
 * Consumers should migrate to `@/lib/ai/schema` or the `@/lib/ai` barrel
 * over time; this shim keeps existing imports working without a
 * cross-cutting rewrite.
 */
export {
  AVAILABLE_MODELS,
  generateReportDeclaration,
  generateKuliahReportDeclaration,
  parseModuleDeclaration,
} from './ai/schema';
