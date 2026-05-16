import { describe, it, expect } from 'vitest';
import {
  INSPECTION_EXECUTORS,
  inspectImageExecutor,
  readNotebookCellExecutor,
} from '@/lib/ai/tools/inspect';
import { TOOL_REGISTRY } from '@/lib/ai/tools';
import type { ToolExecutionContext } from '@/lib/ai/tools';
import type { AIReportData } from '@/lib/types';

/**
 * Validates: Req 6.3 — inspection executors return
 * `{ kind: 'inspect', injectParts }` for valid args and
 * `{ kind: 'noop', reason }` for everything else (out-of-range,
 * malformed data URLs, missing context). They never throw.
 */

const EMPTY_AI_DATA: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
};

const PNG_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PNG_PIXEL_PAYLOAD = PNG_PIXEL.split(',')[1];

function makeCtx(over: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
  return {
    images: {
      pre_test: [],
      implementasi: [],
      post_test: [],
      notebook: [],
    },
    notebooks: [],
    aiData: EMPTY_AI_DATA,
    ...over,
  };
}

describe('inspectImageExecutor', () => {
  it('returns text+image parts for a valid (category, index) pair', () => {
    const ctx = makeCtx({
      images: {
        pre_test: [],
        implementasi: [{ id: 'a', dataUrl: PNG_PIXEL }],
        post_test: [],
        notebook: [],
      },
    });

    const result = inspectImageExecutor.execute(
      { category: 'implementasi', index: 0 },
      ctx,
    );

    expect(result.kind).toBe('inspect');
    if (result.kind !== 'inspect') return;
    expect(result.injectParts).toHaveLength(2);

    const [textPart, imagePart] = result.injectParts as [
      { text: string },
      { inlineData: { mimeType: string; data: string } },
    ];
    expect(textPart.text).toContain('implementasi');
    expect(textPart.text).toContain('index 0');
    expect(imagePart.inlineData.mimeType).toBe('image/png');
    expect(imagePart.inlineData.data).toBe(PNG_PIXEL_PAYLOAD);
  });

  it('returns noop for an unknown category', () => {
    const result = inspectImageExecutor.execute(
      { category: 'screenshots', index: 0 },
      makeCtx(),
    );
    expect(result.kind).toBe('noop');
  });

  it('returns noop when index is out of range', () => {
    const result = inspectImageExecutor.execute(
      { category: 'pre_test', index: 5 },
      makeCtx(),
    );
    expect(result.kind).toBe('noop');
    if (result.kind === 'noop') {
      expect(result.reason).toMatch(/out of range/);
    }
  });

  it('returns noop when index is not a non-negative integer', () => {
    expect(
      inspectImageExecutor.execute({ category: 'pre_test', index: -1 }, makeCtx()).kind,
    ).toBe('noop');
    expect(
      inspectImageExecutor.execute({ category: 'pre_test', index: 1.5 }, makeCtx()).kind,
    ).toBe('noop');
    expect(
      inspectImageExecutor.execute({ category: 'pre_test', index: 'first' }, makeCtx()).kind,
    ).toBe('noop');
  });

  it('returns noop when the matched image has no data URL', () => {
    const ctx = makeCtx({
      images: {
        pre_test: [{ id: 'a', dataUrl: '' }],
        implementasi: [],
        post_test: [],
        notebook: [],
      },
    });
    const result = inspectImageExecutor.execute(
      { category: 'pre_test', index: 0 },
      ctx,
    );
    expect(result.kind).toBe('noop');
  });

  it('returns noop when the data URL is malformed', () => {
    const ctx = makeCtx({
      images: {
        pre_test: [],
        implementasi: [{ id: 'a', dataUrl: 'not-a-data-url' }],
        post_test: [],
        notebook: [],
      },
    });
    const result = inspectImageExecutor.execute(
      { category: 'implementasi', index: 0 },
      ctx,
    );
    expect(result.kind).toBe('noop');
  });
});

describe('readNotebookCellExecutor', () => {
  it('returns a text part containing source and capped outputs', () => {
    const ctx = makeCtx({
      notebooks: [
        {
          cells: [
            {
              cell_type: 'code',
              source: 'print(1)',
              outputs: [
                { type: 'text', content: '1' },
                { type: 'image', content: 'base64stuff' },
              ],
            },
          ],
        },
      ],
    });

    const result = readNotebookCellExecutor.execute(
      { notebookIndex: 0, cellIndex: 0 },
      ctx,
    );

    expect(result.kind).toBe('inspect');
    if (result.kind !== 'inspect') return;
    expect(result.injectParts).toHaveLength(1);
    const text = (result.injectParts[0] as { text: string }).text;
    expect(text).toContain('notebookIndex=0');
    expect(text).toContain('cellIndex=0');
    expect(text).toContain('print(1)');
    expect(text).toContain('[output 0] text');
    expect(text).toContain('[output 1] image');
    // Image content is replaced with an inspect_image hint, not the raw base64.
    expect(text).not.toContain('base64stuff');
  });

  it('caps very long text outputs', () => {
    const huge = 'x'.repeat(10_000);
    const ctx = makeCtx({
      notebooks: [
        {
          cells: [
            {
              cell_type: 'code',
              source: 's',
              outputs: [{ type: 'text', content: huge }],
            },
          ],
        },
      ],
    });
    const result = readNotebookCellExecutor.execute(
      { notebookIndex: 0, cellIndex: 0 },
      ctx,
    );
    expect(result.kind).toBe('inspect');
    if (result.kind !== 'inspect') return;
    const text = (result.injectParts[0] as { text: string }).text;
    expect(text).toContain('[truncated]');
    expect(text.length).toBeLessThan(huge.length);
  });

  it('returns noop on out-of-range notebook or cell index', () => {
    expect(
      readNotebookCellExecutor.execute({ notebookIndex: 0, cellIndex: 0 }, makeCtx()).kind,
    ).toBe('noop');

    const ctx = makeCtx({
      notebooks: [{ cells: [{ cell_type: 'code', source: 's' }] }],
    });
    expect(
      readNotebookCellExecutor.execute({ notebookIndex: 0, cellIndex: 5 }, ctx).kind,
    ).toBe('noop');
  });

  it('returns noop on bad arg types', () => {
    expect(
      readNotebookCellExecutor.execute({ notebookIndex: 'a', cellIndex: 0 }, makeCtx()).kind,
    ).toBe('noop');
    expect(
      readNotebookCellExecutor.execute({ notebookIndex: -1, cellIndex: 0 }, makeCtx()).kind,
    ).toBe('noop');
  });
});

describe('INSPECTION_EXECUTORS registry integration', () => {
  it('exports both inspection executors via the aggregator', () => {
    expect(INSPECTION_EXECUTORS.inspect_image).toBe(inspectImageExecutor);
    expect(INSPECTION_EXECUTORS.read_notebook_cell).toBe(readNotebookCellExecutor);
  });

  it('TOOL_REGISTRY.executors contains both inspection executors', () => {
    expect(TOOL_REGISTRY.executors.inspect_image).toBe(inspectImageExecutor);
    expect(TOOL_REGISTRY.executors.read_notebook_cell).toBe(readNotebookCellExecutor);
  });
});
