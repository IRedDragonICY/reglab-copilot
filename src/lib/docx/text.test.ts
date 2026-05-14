import { describe, it, expect } from 'vitest';
import { sanitizeText } from '@/lib/docx/text';

describe('sanitizeText', () => {
  it('returns empty string for falsy inputs', () => {
    expect(sanitizeText('')).toBe('');
    // Runtime defensive check — `text` is typed `string` but the implementation
    // guards against falsy values, so exercise that branch with a cast.
    expect(sanitizeText(undefined as unknown as string)).toBe('');
    expect(sanitizeText(null as unknown as string)).toBe('');
  });

  it('strips ANSI escape sequences', () => {
    expect(sanitizeText('\u001B[31mred\u001B[0m')).toBe('red');
    expect(sanitizeText('plain')).toBe('plain');
    expect(sanitizeText('hello \u001B[1;32mworld\u001B[0m')).toBe('hello world');
  });

  it('strips C0 and DEL control characters', () => {
    // NUL, SOH, BEL, DEL interleaved with printable text should disappear.
    expect(sanitizeText('a\u0000b\u0001c\u0007d\u007Fe')).toBe('abcde');
  });

  it('preserves tab, CR, LF, and the vertical tab is dropped per the regex', () => {
    // The current implementation keeps tab (\t=\x09), newline (\n=\x0A), carriage return (\r=\x0D).
    // It strips \x0B (VT) and \x0C (FF). Lock in current behavior.
    expect(sanitizeText('line1\nline2\tcol\rend')).toBe('line1\nline2\tcol\rend');
    expect(sanitizeText('vt\u000Bhere')).toBe('vthere');
    expect(sanitizeText('ff\u000Chere')).toBe('ffhere');
  });

  it('leaves multi-byte UTF-8 intact', () => {
    expect(sanitizeText('Praktikum: Ekstraksi Data — naïve façade 日本語 🚀'))
      .toBe('Praktikum: Ekstraksi Data — naïve façade 日本語 🚀');
  });

  it('is idempotent on already-clean text', () => {
    const clean = 'The quick brown fox jumps over the lazy dog.';
    expect(sanitizeText(sanitizeText(clean))).toBe(clean);
  });
});
