import { describe, it, expect } from 'vitest';
import {
  buildGenerationPrompt,
  buildBatchContinuationMessage,
  GENERATION_SYSTEM_INSTRUCTION,
  type GenerationPromptCtx,
} from '@/lib/ai/prompts';

/**
 * The generation prompt is part of Gemini's contract — wording shifts
 * have measurable effects on output quality. These assertions pin down
 * the rules that, in practice, make the difference between a usable
 * report and the "screenshot tanpa penjelasan" failure mode the user
 * reported. They are intentionally substring-level (not full snapshot)
 * so that copy-edits to surrounding sentences don't trip the suite
 * unless the substantive rule is changed.
 */

const baseCtx = (overrides: Partial<GenerationPromptCtx> = {}): GenerationPromptCtx => ({
  isKuliah: false,
  totalImages: 12,
  totalCells: 15,
  judulLaporan: 'Visualisasi Data Bar Chart',
  mataPraktikum: 'Visualisasi Data',
  preTest: '-',
  modulContext: '-',
  postTest: '1. Ubah warna bar.\n2. Tambahkan sort ASC/DESC.',
  notebookPromptData: 'No notebook provided.',
  ...overrides,
});

describe('buildGenerationPrompt — context interpolation', () => {
  it('embeds total image count, judul, post-test, and notebook data', () => {
    const ctx = baseCtx({ totalImages: 27 });
    const prompt = buildGenerationPrompt(ctx);
    expect(prompt).toContain('TOTAL GAMBAR/VISUAL: 27 gambar.');
    expect(prompt).toContain('Visualisasi Data Bar Chart');
    expect(prompt).toContain('Ubah warna bar');
    expect(prompt).toContain('No notebook provided.');
  });

  it('switches the lead paragraph for kuliah reports', () => {
    expect(buildGenerationPrompt(baseCtx({ isKuliah: true })))
      .toContain('LAPORAN KULIAH');
    expect(buildGenerationPrompt(baseCtx({ isKuliah: false })))
      .toContain('Ini adalah format LAPORAN PRAKTIKUM.');
  });

  it('falls back to "-" for empty title and mata praktikum without leaking "undefined"', () => {
    const prompt = buildGenerationPrompt(baseCtx({ judulLaporan: '', mataPraktikum: '' }));
    expect(prompt).toContain('Judul Laporan: -');
    expect(prompt).toContain('Mata Praktikum / Kuliah: -');
    expect(prompt).not.toContain('undefined');
  });
});

describe('buildGenerationPrompt — zero-orphan policy (REGRESSION)', () => {
  // The user reported screenshots that arrived in the docx without any
  // explanation. Root cause was the prompt not strictly demanding a
  // `cellAnalyses` entry per implementation/post-test screenshot. These
  // tests pin the new rule down so it cannot quietly regress.
  const prompt = buildGenerationPrompt(baseCtx());

  it('declares the policy by name', () => {
    expect(prompt).toContain('ZERO-ORPHAN POLICY');
  });

  it('requires every implementasi/post_test image to have an entry with imageIndex', () => {
    expect(prompt).toContain('WAJIB direlasikan melalui `imageIndex`');
    expect(prompt).toContain('imageIndex');
  });

  it('warns the model that orphan images render as "kegagalan mutlak"', () => {
    expect(prompt).toContain('kegagalan mutlak');
  });

  it('mandates a self-check before the final batch', () => {
    expect(prompt.toLowerCase()).toContain('self-check');
  });

  it("locks the section value mapping for post-test vs implementation screenshots", () => {
    expect(prompt).toContain("`'post_test'`");
    expect(prompt).toContain("`'implementasi'`");
  });
});

describe('buildGenerationPrompt — observasi visual wajib', () => {
  const prompt = buildGenerationPrompt(baseCtx());

  it('demands per-screenshot observation of file, line, identifier, output, and diff-from-prev', () => {
    expect(prompt).toContain('OBSERVASI VISUAL WAJIB');
    expect(prompt).toContain('file');
    expect(prompt).toContain('baris');
    expect(prompt).toContain('Identifier');
    expect(prompt).toContain('Output');
    expect(prompt.toLowerCase()).toContain('berubah dari step sebelumnya');
  });

  it('asks the model to tie post-test screenshots back to the post-test question number', () => {
    expect(prompt).toContain('nomor soal Post-Test');
  });
});

describe('buildGenerationPrompt — anti AI-slop ban list', () => {
  const prompt = buildGenerationPrompt(baseCtx());

  it('declares the anti-slop section', () => {
    expect(prompt).toContain('ANTI AI-SLOP');
  });

  it.each([
    'Pada gambar di atas dapat dilihat',
    'Berdasarkan output tersebut',
    'Gambar ini menunjukkan',
    'Potongan kode di atas berfungsi untuk',
  ])('forbids the boilerplate opener: %s', (phrase) => {
    expect(prompt).toContain(phrase);
  });

  it('requires the tone to sound like a real student writing, not a template', () => {
    expect(prompt.toLowerCase()).toContain('natural');
    expect(prompt.toLowerCase()).toContain('mahasiswa');
  });
});

describe('GENERATION_SYSTEM_INSTRUCTION', () => {
  it('includes the per-image explanation requirement', () => {
    expect(GENERATION_SYSTEM_INSTRUCTION.toLowerCase()).toContain('cellanalyses');
    expect(GENERATION_SYSTEM_INSTRUCTION.toLowerCase()).toContain('explanation');
  });

  it('forbids generic boilerplate openers', () => {
    expect(GENERATION_SYSTEM_INSTRUCTION.toLowerCase()).toContain('boilerplate');
  });
});

describe('buildBatchContinuationMessage', () => {
  it('embeds the loop number and total image count', () => {
    expect(buildBatchContinuationMessage(2, 17, 10)).toContain('batch 2');
    expect(buildBatchContinuationMessage(2, 17, 10)).toContain('17 gambar');
  });

  it('reminds the model to fill imageIndex and concrete observations on continuation', () => {
    const msg = buildBatchContinuationMessage(3, 5, 10);
    expect(msg).toContain('imageIndex');
    expect(msg.toLowerCase()).toContain('observasi visual');
  });
});

describe('buildGenerationPrompt — ulasan praktikum', () => {
  it('requires model to inject forced constraint or use user input if provided', () => {
    const prompt = buildGenerationPrompt(baseCtx({ ulasanPraktikum: 'waktu post testnya cuma SEBENTAR' }));
    expect(prompt).toContain('SUNTIKAN KENDALA SECARA PAKSA');
    expect(prompt).toContain('waktu post testnya cuma SEBENTAR');
  });
});
