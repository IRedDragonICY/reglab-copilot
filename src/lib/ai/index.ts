/**
 * Public entry point for the AI layer. Callers should import from
 * `@/lib/ai` rather than reaching into individual modules.
 */

export {
  AVAILABLE_MODELS,
  generateReportDeclaration,
  generateKuliahReportDeclaration,
  parseModuleDeclaration,
} from './schema';

export { mergeReportData } from './merge';
export type { MergeMode, RawToolArgs } from './merge';

export { runAgentLoop } from './agent-loop';
export type {
  AgentLoopArgs,
  AgentLoopCallbacks,
  CopilotMessage,
  ToolCallState,
} from './agent-loop';

export {
  buildGenerationPrompt,
  buildEditPrompt,
  buildBatchContinuationMessage,
  GENERATION_SYSTEM_INSTRUCTION,
  EDIT_SYSTEM_INSTRUCTION,
} from './prompts';
export type { GenerationPromptCtx } from './prompts';
