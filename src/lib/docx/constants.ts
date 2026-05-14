/**
 * DOCX rendering constants. Every color, size, or dimension that appears
 * in more than one place inside `@/lib/docx` is hoisted here so that a
 * visual tweak is a one-line change, not a grep-and-replace.
 */

/** Word measurement: 1 cm = 567 twips (20 twips = 1 point). */
export const CM_TO_TWIP = 567;

/** Maximum image width in docx pixels. The builder clamps to this to avoid
 *  overflowing A4 with margins (~16 cm usable). */
export const MAX_IMG_WIDTH = 600;

export const FONT_CALIBRI = 'Calibri';
export const FONT_MONO = 'Courier New';

/** Neutral palette used by the flat-bordered code and output tables. */
export const PALETTE = {
  borderLight: 'E5E7EB',
  borderDark: 'D1D5DB',
  codeShade: 'F9FAFB',
  titleShade: 'F3F4F6',
  explainShade: 'EFF6FF',
  lineNumber: '6B7280',
  errorText: 'FF0000',
} as const;
