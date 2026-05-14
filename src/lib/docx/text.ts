import { TextRun } from 'docx';
import { FONT_CALIBRI, FONT_MONO } from './constants';

/**
 * Strips ANSI escape sequences and C0/DEL control characters while
 * preserving tab, CR, and LF. Returns '' for falsy input.
 *
 * Behavior is locked in by `text.test.ts`; do not change it without
 * updating the contract test.
 */
export function sanitizeText(text: string): string {
  if (!text) return '';
  let clean = text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean;
}

export interface RunOpts {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  color?: string;
}

/** Factory for a sanitized Calibri-font TextRun at the default body size. */
export function calibriRun(text: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text: sanitizeText(text),
    font: FONT_CALIBRI,
    size: opts.size ?? 22,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
  });
}

/** Factory for a sanitized Courier-New TextRun used for code and raw output. */
export function monoRun(text: string, opts: RunOpts = {}): TextRun {
  return new TextRun({
    text: sanitizeText(text),
    font: FONT_MONO,
    size: opts.size ?? 20,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
  });
}
