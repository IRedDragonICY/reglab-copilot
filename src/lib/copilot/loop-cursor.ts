/**
 * (De)serialization helpers for `LoopCursor`.
 *
 * `LoopCursor` is the resume-state structure for an interrupted
 * Agent_Loop. It is round-tripped through JSON storage
 * (`localStorage`/`idb-keyval`), so we need:
 *
 *   - a thin `JSON.stringify` wrapper for writes
 *   - a defensive parser that validates shape on reads, since legacy
 *     IndexedDB payloads or hand-edited backups can deliver anything
 *
 * `LoopCursor` is already JSON-safe: `Content[]` from `@google/genai`
 * is JSON-safe, our `accumulatedAiData` is JSON-safe, and
 * `pendingTools` is JSON-safe.
 *
 * The validator intentionally treats `inlineData` payloads inside
 * `contents[*].parts[*]` as opaque — base64 image data should not be
 * re-walked on every hydration, and the SDK is the source of truth
 * for that shape.
 *
 * Validation failures throw `LoopCursorError` with a message that
 * names the offending field; JSON parse failures throw
 * `LoopCursorError` with the underlying error attached as `cause`.
 */

import type { LoopCursor, PendingTool } from '@/lib/copilot/types';

/** Typed error thrown by both serialize and deserialize on failure. */
export class LoopCursorError extends Error {
  constructor(
    msg: string,
    public readonly cause?: unknown,
  ) {
    super(msg);
    this.name = 'LoopCursorError';
  }
}

/**
 * Serialize a `LoopCursor` to a JSON string. `LoopCursor` is fully
 * JSON-safe by construction, so this is a thin wrapper. Kept as a
 * dedicated export so callers don't need to know the exact shape and
 * so a future migration to e.g. compressed binary doesn't require
 * touching every call site.
 */
export function serializeLoopCursor(c: LoopCursor): string {
  try {
    return JSON.stringify(c);
  } catch (err) {
    // `JSON.stringify` only throws on circular references or
    // BigInt — neither should appear in a well-formed cursor, but
    // surface a typed error if they do.
    throw new LoopCursorError('Failed to serialize LoopCursor', err);
  }
}

/**
 * Parse and validate a serialized `LoopCursor`. Throws
 * `LoopCursorError` on malformed JSON or shape mismatch. The returned
 * value is a structurally-validated `LoopCursor` — fields that are
 * declared as opaque (e.g. `Content[]` parts, `accumulatedAiData`
 * leaf strings) are not deeply walked.
 */
export function deserializeLoopCursor(raw: string): LoopCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new LoopCursorError(
      `Failed to parse LoopCursor JSON: ${(err as Error).message}`,
      err,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new LoopCursorError(
      `LoopCursor must be an object, got ${describe(parsed)}`,
    );
  }

  const obj = parsed as Record<string, unknown>;

  requireArray(obj, 'contents');
  requireNumber(obj, 'iterationIndex');
  requireNumber(obj, 'lastSuccessfulMergeIndex');
  requireObject(obj, 'accumulatedAiData');
  requireMode(obj, 'mode');
  requireDeclarationKey(obj, 'declarationKey');
  requireString(obj, 'systemInstruction');
  requireString(obj, 'modelId');
  requireNumber(obj, 'maxLoops');
  requireBoolean(obj, 'enableGoogleSearch');
  requireBoolean(obj, 'enableCodeExecution');
  requireArray(obj, 'pendingTools');

  const pendingTools = obj.pendingTools as unknown[];
  // Validate each pending tool. Order is preserved implicitly — we
  // never sort or reorder, just walk and validate in place.
  pendingTools.forEach((tool, i) => validatePendingTool(tool, i));

  // Cast is safe: every required field has been validated above and
  // opaque fields (Content parts, AIReportData internals, args) are
  // declared `unknown`/`any` in their source types.
  return obj as unknown as LoopCursor;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function requireArray(obj: Record<string, unknown>, field: string): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (!Array.isArray(obj[field])) {
    throw new LoopCursorError(
      `LoopCursor.${field} must be an array, got ${describe(obj[field])}`,
    );
  }
}

function requireNumber(obj: Record<string, unknown>, field: string): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (typeof obj[field] !== 'number' || Number.isNaN(obj[field] as number)) {
    throw new LoopCursorError(
      `LoopCursor.${field} must be a number, got ${describe(obj[field])}`,
    );
  }
}

function requireString(obj: Record<string, unknown>, field: string): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (typeof obj[field] !== 'string') {
    throw new LoopCursorError(
      `LoopCursor.${field} must be a string, got ${describe(obj[field])}`,
    );
  }
}

function requireBoolean(obj: Record<string, unknown>, field: string): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (typeof obj[field] !== 'boolean') {
    throw new LoopCursorError(
      `LoopCursor.${field} must be a boolean, got ${describe(obj[field])}`,
    );
  }
}

function requireObject(obj: Record<string, unknown>, field: string): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (!isPlainObject(obj[field])) {
    throw new LoopCursorError(
      `LoopCursor.${field} must be an object, got ${describe(obj[field])}`,
    );
  }
}

function requireMode(obj: Record<string, unknown>, field: string): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (obj[field] !== 'append' && obj[field] !== 'replace') {
    throw new LoopCursorError(
      `LoopCursor.${field} must be 'append' or 'replace', got ${JSON.stringify(obj[field])}`,
    );
  }
}

function requireDeclarationKey(
  obj: Record<string, unknown>,
  field: string,
): void {
  if (!(field in obj)) {
    throw new LoopCursorError(`LoopCursor missing required field: ${field}`);
  }
  if (obj[field] !== 'praktikum' && obj[field] !== 'kuliah') {
    throw new LoopCursorError(
      `LoopCursor.${field} must be 'praktikum' or 'kuliah', got ${JSON.stringify(obj[field])}`,
    );
  }
}

function validatePendingTool(tool: unknown, i: number): asserts tool is PendingTool {
  if (!isPlainObject(tool)) {
    throw new LoopCursorError(
      `LoopCursor.pendingTools[${i}] must be an object, got ${describe(tool)}`,
    );
  }
  if (typeof tool.name !== 'string') {
    throw new LoopCursorError(
      `LoopCursor.pendingTools[${i}].name must be a string, got ${describe(tool.name)}`,
    );
  }
  if (!('args' in tool)) {
    throw new LoopCursorError(
      `LoopCursor.pendingTools[${i}].args is required`,
    );
  }
  if (typeof tool.id !== 'string') {
    throw new LoopCursorError(
      `LoopCursor.pendingTools[${i}].id must be a string, got ${describe(tool.id)}`,
    );
  }
  if (
    'thoughtSignature' in tool &&
    tool.thoughtSignature !== undefined &&
    typeof tool.thoughtSignature !== 'string'
  ) {
    throw new LoopCursorError(
      `LoopCursor.pendingTools[${i}].thoughtSignature must be a string when present, got ${describe(tool.thoughtSignature)}`,
    );
  }
}
