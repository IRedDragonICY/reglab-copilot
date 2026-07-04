import { describe, it, expect } from 'vitest';
import { Type } from '@google/genai';
import {
  ALL_GRANULAR_DECLARATIONS,
  addCellAnalysisDeclaration,
  updateCellAnalysisDeclaration,
  deleteCellAnalysisDeclaration,
  setPendahuluanDeclaration,
  setAlatDanBahanDeclaration,
  setStepByStepNarrativeDeclaration,
  setCodeAnalysisDeclaration,
  setPreTestQaDeclaration,
  setPostTestQaDeclaration,
  setUlasanPraktikumDeclaration,
  setTaskPlanDeclaration,
  updateTaskStatusDeclaration,
  requestUserClarificationDeclaration,
  markTaskCompleteDeclaration,
  inspectImageDeclaration,
  readNotebookCellDeclaration,
} from '@/lib/ai/tools/declarations';

/**
 * Snapshot + structural tests for the granular tool declarations
 * (task 8.1). The snapshot locks the bytes sent to Gemini exactly the
 * same way `schema.test.ts` does for the legacy declarations — any
 * description tweak or property rename is a deliberate behavior
 * change, so it must update the snapshot through review.
 *
 * The structural assertions guard the contract enumerated in Req 6
 * and Req 9.4: 16 tools total, all with a non-empty name + description
 * and a `Type.OBJECT` root, with no legacy names sneaking into the
 * granular bundle.
 */

function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[Circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      sorted[k] = walk((v as Record<string, unknown>)[k]);
    }
    return sorted;
  };
  return JSON.stringify(walk(value), null, 2);
}

describe('ALL_GRANULAR_DECLARATIONS — byte stability', () => {
  it('matches the locked snapshot of all 16 declarations', () => {
    expect(stableStringify(ALL_GRANULAR_DECLARATIONS)).toMatchSnapshot();
  });
});

describe('ALL_GRANULAR_DECLARATIONS — structural invariants', () => {
  it('contains exactly 16 declarations', () => {
    expect(ALL_GRANULAR_DECLARATIONS).toHaveLength(16);
  });

  it('every declaration has a non-empty name, description, and Type.OBJECT root', () => {
    for (const decl of ALL_GRANULAR_DECLARATIONS) {
      expect(decl.name).toBeTruthy();
      expect(typeof decl.name).toBe('string');
      expect(decl.name.length).toBeGreaterThan(0);

      expect(decl.description).toBeTruthy();
      expect(typeof decl.description).toBe('string');
      expect(decl.description.length).toBeGreaterThan(0);

      const params = decl.parameters as { type: unknown };
      expect(params).toBeTruthy();
      expect(params.type).toBe(Type.OBJECT);
    }
  });

  it('does NOT include any legacy declaration name (Req 6.8, 9.4)', () => {
    const names = ALL_GRANULAR_DECLARATIONS.map((d) => d.name);
    expect(names).not.toContain('generate_report');
    expect(names).not.toContain('generate_kuliah_report');
    expect(names).not.toContain('parse_module_praktikum');
  });

  it('tool names are unique across the aggregate', () => {
    const names = ALL_GRANULAR_DECLARATIONS.map((d) => d.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('exports the expected 15 named declarations and the aggregate references them in order', () => {
    expect(ALL_GRANULAR_DECLARATIONS).toEqual([
      addCellAnalysisDeclaration,
      updateCellAnalysisDeclaration,
      deleteCellAnalysisDeclaration,
      setPendahuluanDeclaration,
      setAlatDanBahanDeclaration,
      setStepByStepNarrativeDeclaration,
      setCodeAnalysisDeclaration,
      setPreTestQaDeclaration,
      setPostTestQaDeclaration,
      setUlasanPraktikumDeclaration,
      setTaskPlanDeclaration,
      updateTaskStatusDeclaration,
      requestUserClarificationDeclaration,
      markTaskCompleteDeclaration,
      inspectImageDeclaration,
      readNotebookCellDeclaration,
    ]);
  });
});
