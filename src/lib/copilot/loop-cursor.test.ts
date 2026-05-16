import { describe, it, expect } from 'vitest';
import {
  serializeLoopCursor,
  deserializeLoopCursor,
  LoopCursorError,
} from '@/lib/copilot/loop-cursor';
import type { LoopCursor } from '@/lib/copilot/types';
import type { AIReportData } from '@/lib/types';

/**
 * Validates: the LoopCursor (de)serialization contract from task 1.3 of
 * the copilot-agent-upgrade spec — JSON round-trip preserves every
 * field including pendingTools order, malformed input throws a typed
 * LoopCursorError naming the offending field, and inline image data
 * inside contents is preserved verbatim.
 */

const SAMPLE_AI_DATA: AIReportData = {
  pendahuluan: 'Intro paragraph',
  preTestAnswers: [{ q: 'pre q', a: 'pre a' }],
  postTestAnswers: [{ q: 'post q', a: 'post a' }],
  stepByStepNarrative: 'first then next',
  codeAnalysis: 'code is fine',
  alatDanBahan: ['VS Code', 'Python'],
  cellAnalyses: [
    {
      notebookIndex: 0,
      cellIndex: 1,
      imageIndex: 0,
      section: 'implementasi',
      caption: 'Cell 1',
      explanation: 'cell 1 does X',
    },
  ],
};

function makeFullCursor(): LoopCursor {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Generate the report.' },
          {
            inlineData: {
              mimeType: 'image/png',
              data: 'base64stuff',
            },
          },
        ],
      },
      {
        role: 'model',
        parts: [{ text: 'Working on it.' }],
      },
    ],
    iterationIndex: 3,
    lastSuccessfulMergeIndex: 2,
    accumulatedAiData: SAMPLE_AI_DATA,
    mode: 'append',
    declarationKey: 'praktikum',
    systemInstruction: 'You are a helpful copilot.',
    modelId: 'gemini-3.0-pro',
    maxLoops: 15,
    enableGoogleSearch: true,
    enableCodeExecution: false,
    pendingTools: [
      {
        name: 'add_cell_analysis',
        args: { entry: { section: 'implementasi' } },
        id: 'tool-1',
        thoughtSignature: 'sig-abc',
      },
      {
        // Mixed thoughtSignature presence — second entry omits it.
        name: 'set_pendahuluan',
        args: { text: 'New intro' },
        id: 'tool-2',
      },
    ],
  };
}

describe('serializeLoopCursor / deserializeLoopCursor', () => {
  it('round-trips every field including mixed pendingTools and inline image parts', () => {
    const cursor = makeFullCursor();
    const raw = serializeLoopCursor(cursor);
    const restored = deserializeLoopCursor(raw);

    expect(restored).toEqual(cursor);
    // Specifically confirm the inline image survived without
    // recursive re-validation collapsing it.
    expect(restored.contents[0]?.parts?.[1]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'base64stuff' },
    });
  });

  it('preserves pendingTools order across the round-trip', () => {
    const cursor = makeFullCursor();
    cursor.pendingTools = ['a', 'b', 'c', 'd', 'e'].map((n, i) => ({
      name: n,
      args: { i },
      id: `id-${n}`,
    }));

    const restored = deserializeLoopCursor(serializeLoopCursor(cursor));

    expect(restored.pendingTools.map((t) => t.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('preserves inline image data byte-for-byte across the round-trip', () => {
    const cursor = makeFullCursor();
    cursor.contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: { mimeType: 'image/png', data: 'base64stuff' },
          },
        ],
      },
    ];

    const restored = deserializeLoopCursor(serializeLoopCursor(cursor));

    expect(restored).toEqual(cursor);
    expect(restored.contents[0]?.parts?.[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'base64stuff' },
    });
  });

  it('throws LoopCursorError with a "parse" message on malformed JSON', () => {
    expect(() => deserializeLoopCursor('{ not json')).toThrowError(
      LoopCursorError,
    );
    try {
      deserializeLoopCursor('{ not json');
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(LoopCursorError);
      expect((err as LoopCursorError).message.toLowerCase()).toContain('parse');
      expect((err as LoopCursorError).cause).toBeDefined();
    }
  });

  it('throws LoopCursorError naming the missing required field', () => {
    const cursor = makeFullCursor() as Partial<LoopCursor>;
    delete cursor.iterationIndex;
    const raw = JSON.stringify(cursor);

    expect(() => deserializeLoopCursor(raw)).toThrowError(
      /iterationIndex/,
    );
    expect(() => deserializeLoopCursor(raw)).toThrowError(LoopCursorError);
  });

  it('throws LoopCursorError naming the field with the wrong type', () => {
    const cursor = makeFullCursor() as unknown as Record<string, unknown>;
    cursor.iterationIndex = 'three';
    const raw = JSON.stringify(cursor);

    expect(() => deserializeLoopCursor(raw)).toThrowError(
      /iterationIndex/,
    );
  });

  it('throws LoopCursorError mentioning pendingTools[i].name when name is missing', () => {
    const cursor = makeFullCursor();
    // Drop `name` from the second pending tool (index 1).
    const tampered = JSON.parse(serializeLoopCursor(cursor));
    delete tampered.pendingTools[1].name;
    const raw = JSON.stringify(tampered);

    expect(() => deserializeLoopCursor(raw)).toThrowError(
      /pendingTools\[1\]\.name/,
    );
    expect(() => deserializeLoopCursor(raw)).toThrowError(LoopCursorError);
  });
});
