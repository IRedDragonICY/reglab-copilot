import { GoogleGenAI, FunctionCallingConfigMode, Content, Part } from '@google/genai';
import type { AIReportData } from '@/lib/types';
import { mergeReportData, type MergeMode } from './merge';

/**
 * Agentic multi-turn streaming loop for the Copilot Generate / Edit flows.
 *
 * The legacy hook inlined this 150-line body; worse, it read function
 * calls from *two* separate chunk fields (`chunk.candidates[0].content.parts`
 * AND `chunk.functionCalls`) with duplicated tool-state bookkeeping. This
 * module collapses both into a single `extractDelta` discriminated union
 * and exposes a callback-driven API so the React layer is a thin binding.
 */

export interface ToolCallState {
  name: string;
  status: 'running' | 'completed';
  args?: unknown;
}

export interface CopilotMessage {
  role: 'user' | 'agent' | 'system';
  text: string;
  isThinking?: boolean;
  thought?: string;
  tools?: ToolCallState[];
  id?: string;
}

export interface AgentLoopCallbacks {
  /** Called each time the agent's "thought" stream grows. */
  onThought?: (thoughtSoFar: string) => void;
  /** Called each time plain text (non-function-call) grows. */
  onText?: (textSoFar: string) => void;
  /** Called when the active tool-call list changes (new tool or new args). */
  onToolUpdate?: (tools: ToolCallState[]) => void;
  /** Streaming-time preview of the merged data (mode: 'preview' or 'replace'). */
  onPreviewMerge?: (next: AIReportData) => void;
  /** Called at the end of each loop iteration with the authoritative merge. */
  onMergeComplete?: (next: AIReportData, loopIndex: number) => void;
  /** Called once per iteration with a human-readable status string. */
  onStatus?: (status: string) => void;
  /** Called at the start of each iteration — returns the id to tag the new agent message. */
  onIterationStart?: (loopIndex: number) => string;
  /** Called when an iteration's agent message finishes streaming. */
  onIterationEnd?: (msgId: string, finalTools: ToolCallState[]) => void;
  /** Called after a successful tool-call merge to inject a system message. */
  onSystemMessage?: (text: string) => void;
}

export interface AgentLoopArgs {
  apiKey: string;
  modelId: string;
  /** Mutated in-place to extend the conversation history across iterations. */
  contents: Content[];
  systemInstruction: string;
  declaration: unknown;
  maxLoops: number;
  /** Builds the "continue batch" message after each successful tool call. */
  sysMsgBuilder: (loopIndex: number) => string;
  mode: Extract<MergeMode, 'append' | 'replace'>;
  initial: AIReportData;
  callbacks: AgentLoopCallbacks;
}

/**
 * Internal per-chunk delta. Collapses the two places Gemini places tool
 * calls (candidate-parts stream and `functionCalls` convenience field).
 */
type StreamDelta =
  | { kind: 'thought'; text: string }
  | { kind: 'text'; text: string }
  | {
      kind: 'tool';
      name: string;
      args: unknown;
      id: string;
      thoughtSignature?: string;
    };

function* extractDeltas(chunk: unknown): Generator<StreamDelta> {
  const c = chunk as {
    candidates?: { content?: { parts?: Part[] } }[];
    functionCalls?: { name?: string; args?: unknown; id?: string }[];
  };

  const parts = c.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      const p = part as Part & {
        thought?: boolean;
        thoughtSignature?: string;
        thought_signature?: string;
      };
      const thoughtSignature = p.thoughtSignature || p.thought_signature;

      if (p.thought) {
        yield { kind: 'thought', text: p.text || '' };
      } else if (p.text) {
        yield { kind: 'text', text: p.text };
      } else if (p.functionCall) {
        yield {
          kind: 'tool',
          name: p.functionCall.name || '',
          args: p.functionCall.args,
          id: p.functionCall.id || '',
          thoughtSignature,
        };
      }
    }
  }

  // Fallback: some SDK versions also surface function calls here.
  if (c.functionCalls && c.functionCalls.length > 0) {
    const fc = c.functionCalls[0];
    yield {
      kind: 'tool',
      name: fc.name || '',
      args: fc.args ?? null,
      id: fc.id || '',
    };
  }
}

/**
 * Upsert a tool-call into the active list by name, returning whether the
 * list materially changed (so the caller can avoid spurious re-renders).
 */
function upsertTool(active: ToolCallState[], name: string, args: unknown): boolean {
  const existing = active.find((t) => t.name === name);
  if (!existing) {
    active.push({ name, status: 'running', args });
    return true;
  }
  if (JSON.stringify(existing.args) !== JSON.stringify(args)) {
    existing.args = args;
    return true;
  }
  return false;
}

export async function runAgentLoop(args: AgentLoopArgs): Promise<AIReportData> {
  const {
    apiKey,
    modelId,
    contents,
    systemInstruction,
    declaration,
    maxLoops,
    sysMsgBuilder,
    mode,
    initial,
    callbacks,
  } = args;

  const ai = new GoogleGenAI({ apiKey });
  let accumulated: AIReportData = { ...initial };
  let loopIndex = 0;
  let isDone = false;

  while (!isDone && loopIndex < maxLoops) {
    loopIndex++;
    callbacks.onStatus?.(
      loopIndex === 1
        ? 'Memeriksa dan mengatur urutan gambar (Cognitive Sorting)...'
        : `Melanjutkan ekstraksi data (Batch ${loopIndex})...`,
    );

    const msgId = callbacks.onIterationStart?.(loopIndex) ?? '';

    const stream = await ai.models.generateContentStream({
      model: modelId,
      contents: contents as Part[],
      config: {
        systemInstruction,
        temperature: 0.2,
        thinkingConfig: { includeThoughts: true },
        tools: [{ functionDeclarations: [declaration] as never }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      },
    });

    let toolName = '';
    let toolArgs: unknown = null;
    let toolId = '';
    let thoughtSignature = '';
    let thoughtStream = '';
    let textStream = '';
    const activeTools: ToolCallState[] = [];

    for await (const chunk of stream) {
      let changed = false;

      for (const delta of extractDeltas(chunk)) {
        switch (delta.kind) {
          case 'thought':
            thoughtStream += delta.text;
            changed = true;
            break;
          case 'text':
            textStream += delta.text;
            changed = true;
            break;
          case 'tool':
            toolName = delta.name || toolName;
            toolArgs = delta.args ?? toolArgs;
            toolId = delta.id || toolId;
            if (delta.thoughtSignature) thoughtSignature = delta.thoughtSignature;
            if (upsertTool(activeTools, delta.name, delta.args)) changed = true;
            break;
        }
      }

      if (changed) {
        callbacks.onThought?.(thoughtStream);
        callbacks.onText?.(textStream);
        callbacks.onToolUpdate?.([...activeTools]);
      }

      // Streaming-time preview merge: non-authoritative, best-effort.
      if (toolName === 'generate_report' && toolArgs) {
        try {
          const previewMode: MergeMode = mode === 'replace' ? 'replace' : 'preview';
          const previewed = mergeReportData(
            accumulated,
            toolArgs as Parameters<typeof mergeReportData>[1],
            previewMode,
          );
          callbacks.onPreviewMerge?.(previewed);
        } catch {
          // Preview failures are non-fatal; the authoritative merge below
          // still runs on the final args.
        }
      }
    }

    // Extend the conversation with the model's turn.
    const modelParts: Part[] = [];
    if (textStream) modelParts.push({ text: textStream } as Part);

    if (toolArgs && toolName) {
      const fcPart: Part & { thoughtSignature?: string; thought_signature?: string } = {
        functionCall: { name: toolName, args: toolArgs as Record<string, unknown>, id: toolId },
      } as Part;
      if (thoughtSignature) {
        fcPart.thoughtSignature = thoughtSignature;
        fcPart.thought_signature = thoughtSignature;
      }
      modelParts.push(fcPart);
    }

    if (modelParts.length > 0) {
      contents.push({ role: 'model', parts: modelParts });
    } else if (thoughtStream) {
      contents.push({ role: 'model', parts: [{ text: '' } as Part] });
    }

    // Authoritative merge + continue-or-stop decision.
    if (toolName === 'generate_report' && toolArgs) {
      accumulated = mergeReportData(
        accumulated,
        toolArgs as Parameters<typeof mergeReportData>[1],
        mode,
      );
      callbacks.onMergeComplete?.(accumulated, loopIndex);

      // Flip the running tool to completed.
      for (const t of activeTools) if (t.name === toolName) t.status = 'completed';
      callbacks.onIterationEnd?.(msgId, [...activeTools]);

      const sysText = sysMsgBuilder(loopIndex);
      callbacks.onSystemMessage?.(sysText);

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolName,
              id: toolId,
              response: { status: 'success', message: sysText },
            },
          } as Part,
        ],
      });
    } else {
      callbacks.onIterationEnd?.(msgId, [...activeTools]);
      isDone = true;
    }
  }

  return accumulated;
}
