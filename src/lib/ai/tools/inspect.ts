/**
 * Inspection tool executors (task 10.2).
 *
 * Two read-only tools that return `{ kind: 'inspect', injectParts }`
 * for the agent loop to prepend onto the next user turn:
 *
 *   - `inspect_image(category, index)`  → re-fetch one uploaded image
 *   - `read_notebook_cell(nbIdx, cellIdx)` → cell source + outputs as text
 *
 * Out-of-bounds indices, unknown categories, or missing context all
 * yield `{ kind: 'noop', reason }` — never throw. The reason string
 * round-trips back to Gemini in the iteration's `functionResponse`
 * payload so the model can self-correct.
 *
 * `ctx.images.notebook` is an array of `{ dataUrl }` records — the
 * Copilot harvests inline image outputs from notebook cells into this
 * pool at session-load time so the agent can re-inspect a chart by
 * absolute index without re-walking the notebook tree.
 */

import type { Part } from '@google/genai';
import type { ToolExecutor, ToolExecutorResult, ToolExecutionContext } from './index';

function isObjectLike(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

const VALID_CATEGORIES = ['pre_test', 'implementasi', 'post_test', 'notebook'] as const;
type ImageCategory = (typeof VALID_CATEGORIES)[number];

function isImageCategory(x: unknown): x is ImageCategory {
  return typeof x === 'string' && (VALID_CATEGORIES as readonly string[]).includes(x);
}

/**
 * Split a `data:image/<mime>;base64,<payload>` URL into the parts the
 * Gemini SDK expects (`mimeType` + bare base64 string). Returns null
 * for malformed inputs so the executor can surface a clean noop reason
 * instead of crashing the loop on a corrupted upload.
 */
function splitDataUrl(
  dataUrl: string,
): { mimeType: string; data: string } | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const header = dataUrl.slice(5, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);
  // Header looks like `image/png;base64`; the base64 marker is required
  // because the SDK's `inlineData.data` is a base64 string, not a raw
  // URI-encoded payload.
  const semi = header.indexOf(';');
  if (semi < 0) return null;
  const mimeType = header.slice(0, semi);
  if (!mimeType.startsWith('image/')) return null;
  if (!data) return null;
  return { mimeType, data };
}

/** `inspect_image(category, index)` — pull one image into the next turn. */
export const inspectImageExecutor: ToolExecutor = {
  name: 'inspect_image',
  execute: (rawArgs, ctx): ToolExecutorResult => {
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'inspect_image: args must be an object' };
    }
    if (!isImageCategory(rawArgs.category)) {
      return {
        kind: 'noop',
        reason: `inspect_image: category must be one of ${VALID_CATEGORIES.join(', ')}`,
      };
    }
    if (typeof rawArgs.index !== 'number' || !Number.isInteger(rawArgs.index) || rawArgs.index < 0) {
      return { kind: 'noop', reason: 'inspect_image: index must be a non-negative integer' };
    }

    const category = rawArgs.category;
    const index = rawArgs.index;
    const bucket = ctx?.images?.[category];
    if (!Array.isArray(bucket) || index >= bucket.length) {
      return {
        kind: 'noop',
        reason: `inspect_image: index ${index} is out of range for category "${category}" (length ${bucket?.length ?? 0})`,
      };
    }

    const entry = bucket[index];
    const dataUrl =
      typeof (entry as { dataUrl?: unknown }).dataUrl === 'string'
        ? (entry as { dataUrl: string }).dataUrl
        : null;
    if (!dataUrl) {
      return {
        kind: 'noop',
        reason: `inspect_image: image at ${category}[${index}] has no dataUrl`,
      };
    }
    const split = splitDataUrl(dataUrl);
    if (!split) {
      return {
        kind: 'noop',
        reason: `inspect_image: could not parse data URL at ${category}[${index}]`,
      };
    }

    // Header text first, image second — matches the SDK's "place the
    // text prompt after the image part" guidance for single-image
    // tasks (see image-understanding docs cited in the user request).
    const injectParts: Part[] = [
      {
        text:
          `[INSPECTION REQUEST] Re-examine image from category "${category}" at index ${index}. ` +
          `Read the visual carefully and use the result to refine the relevant CellAnalysis entry.`,
      } as Part,
      { inlineData: { mimeType: split.mimeType, data: split.data } } as Part,
    ];

    return { kind: 'inspect', injectParts };
  },
};

/** `read_notebook_cell(notebookIndex, cellIndex)` — text snapshot only. */
export const readNotebookCellExecutor: ToolExecutor = {
  name: 'read_notebook_cell',
  execute: (rawArgs, ctx): ToolExecutorResult => {
    if (!isObjectLike(rawArgs)) {
      return { kind: 'noop', reason: 'read_notebook_cell: args must be an object' };
    }
    const { notebookIndex, cellIndex } = rawArgs;
    if (typeof notebookIndex !== 'number' || !Number.isInteger(notebookIndex) || notebookIndex < 0) {
      return { kind: 'noop', reason: 'read_notebook_cell: notebookIndex must be a non-negative integer' };
    }
    if (typeof cellIndex !== 'number' || !Number.isInteger(cellIndex) || cellIndex < 0) {
      return { kind: 'noop', reason: 'read_notebook_cell: cellIndex must be a non-negative integer' };
    }

    const notebooks = ctx?.notebooks;
    if (!Array.isArray(notebooks) || notebookIndex >= notebooks.length) {
      return {
        kind: 'noop',
        reason: `read_notebook_cell: notebookIndex ${notebookIndex} is out of range (length ${notebooks?.length ?? 0})`,
      };
    }
    const cells = notebooks[notebookIndex]?.cells;
    if (!Array.isArray(cells) || cellIndex >= cells.length) {
      return {
        kind: 'noop',
        reason: `read_notebook_cell: cellIndex ${cellIndex} is out of range for notebook ${notebookIndex} (length ${cells?.length ?? 0})`,
      };
    }
    const cell = cells[cellIndex];

    // Image outputs are intentionally elided from the text we surface —
    // the agent should call `inspect_image` for a visual. We replace
    // them with a placeholder so the model still sees the cell had a
    // visual output but we don't blow the iteration's token budget.
    const lines: string[] = [];
    lines.push(`[NOTEBOOK CELL] notebookIndex=${notebookIndex} cellIndex=${cellIndex} type=${cell.cell_type}`);
    lines.push('--- source ---');
    lines.push(cell.source ?? '');
    if (Array.isArray(cell.outputs) && cell.outputs.length > 0) {
      lines.push('--- outputs ---');
      cell.outputs.forEach((out, i) => {
        if (out.type === 'image') {
          lines.push(`[output ${i}] image (use inspect_image with category="notebook" and the matching index to view)`);
        } else {
          // text or html — surface verbatim, capped to avoid runaway
          // inputs from a misbehaving notebook.
          const content = String(out.content ?? '');
          const capped = content.length > 4000 ? content.slice(0, 4000) + '\n…[truncated]' : content;
          lines.push(`[output ${i}] ${out.type}:`);
          lines.push(capped);
        }
      });
    }

    return {
      kind: 'inspect',
      injectParts: [{ text: lines.join('\n') } as Part],
    };
  },
};

/**
 * Aggregator consumed by `tools/index.ts` on module load. Same
 * registration pattern as `GRANULAR_EXECUTORS` and `META_EXECUTORS`.
 */
export const INSPECTION_EXECUTORS: Record<string, ToolExecutor> = {
  inspect_image: inspectImageExecutor,
  read_notebook_cell: readNotebookCellExecutor,
};

// Re-export the context shape so the test file (and any future
// consumer) can build a minimal stub without importing `./index`.
export type { ToolExecutionContext };
