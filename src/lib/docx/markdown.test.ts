import { describe, it, expect } from 'vitest';
import { tokenizeInline, type InlineToken } from '@/lib/docx/markdown';

/**
 * These tests pin down the inline tokenizer that powers
 * `parseMarkdownToParagraphs`. The regression motivating most cases is:
 *
 *   *Excel (Normalized): ... ![math_inline](data:image/png;base64,XXX) 0,29*
 *
 * The pre-fix tokenizer used a flat regex split where the italic
 * alternative `\*.*?\*` could swallow an embedded `![](data:...)` image
 * span, which then dumped the raw base64 payload into the DOCX as plain
 * text. The new tokenizer extracts images first into placeholders, then
 * resolves bold/italic, then re-injects images so the surrounding style
 * is preserved on the text without ever turning a base64 URL into a
 * delimited italic run.
 */

const TEXT = (text: string, opts: { bold?: boolean; italic?: boolean } = {}): InlineToken =>
  ({ kind: 'text', text, bold: !!opts.bold, italic: !!opts.italic });

const IMG = (url: string, alt = ''): InlineToken => ({ kind: 'image', url, alt });

describe('tokenizeInline — plain text', () => {
  it('returns empty for empty input', () => {
    expect(tokenizeInline('')).toEqual([]);
  });

  it('preserves a string with no markup', () => {
    expect(tokenizeInline('Hello world.')).toEqual([TEXT('Hello world.')]);
  });

  it('does not mistake parentheses for delimiters', () => {
    expect(tokenizeInline('Excel (Normalized): foo')).toEqual([TEXT('Excel (Normalized): foo')]);
  });

  it('does not mistake colons or quotes for delimiters', () => {
    expect(tokenizeInline('TF "asik" di Dokumen 1: 0,29')).toEqual([
      TEXT('TF "asik" di Dokumen 1: 0,29'),
    ]);
  });
});

describe('tokenizeInline — bold and italic', () => {
  it('parses a single bold span', () => {
    expect(tokenizeInline('a **bold** b')).toEqual([
      TEXT('a '),
      TEXT('bold', { bold: true }),
      TEXT(' b'),
    ]);
  });

  it('parses a single italic span', () => {
    expect(tokenizeInline('a *italic* b')).toEqual([
      TEXT('a '),
      TEXT('italic', { italic: true }),
      TEXT(' b'),
    ]);
  });

  it('parses bold containing italic', () => {
    expect(tokenizeInline('**bold *and* end**')).toEqual([
      TEXT('bold ', { bold: true }),
      TEXT('and', { bold: true, italic: true }),
      TEXT(' end', { bold: true }),
    ]);
  });

  it('parses italic containing bold', () => {
    expect(tokenizeInline('*it **bold** rest*')).toEqual([
      TEXT('it ', { italic: true }),
      TEXT('bold', { bold: true, italic: true }),
      TEXT(' rest', { italic: true }),
    ]);
  });

  it('treats an unmatched asterisk as literal text', () => {
    expect(tokenizeInline('5 * 2 = 10')).toEqual([TEXT('5 * 2 = 10')]);
  });

  it('treats an unmatched double asterisk as literal text', () => {
    expect(tokenizeInline('two ** three')).toEqual([TEXT('two ** three')]);
  });

  it('parses adjacent bold spans', () => {
    expect(tokenizeInline('**a****b**')).toEqual([
      TEXT('a', { bold: true }),
      TEXT('b', { bold: true }),
    ]);
  });

  it('does not let a stray ** mid-string close a single-* italic', () => {
    expect(tokenizeInline('*one ** two*')).toEqual([
      TEXT('one ** two', { italic: true }),
    ]);
  });
});

describe('tokenizeInline — images', () => {
  const SMALL_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  it('extracts a bare image', () => {
    expect(tokenizeInline(`pre ![alt](${SMALL_PNG}) post`)).toEqual([
      TEXT('pre '),
      IMG(SMALL_PNG, 'alt'),
      TEXT(' post'),
    ]);
  });

  it('extracts adjacent images without an intervening space', () => {
    expect(tokenizeInline(`![a](${SMALL_PNG})![b](${SMALL_PNG})`)).toEqual([
      IMG(SMALL_PNG, 'a'),
      IMG(SMALL_PNG, 'b'),
    ]);
  });

  it('handles an empty alt text', () => {
    expect(tokenizeInline(`![](${SMALL_PNG})`)).toEqual([IMG(SMALL_PNG, '')]);
  });
});

describe('tokenizeInline — image inside italic (REGRESSION)', () => {
  // The full payload doesn't matter; what matters is that the parser
  // never treats characters inside `(...)` of a markdown image as
  // italic delimiters.
  const URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA';

  it('keeps an image as a separate token inside an italic span', () => {
    const input = `*Excel (Normalized): bernilai ![math_inline](${URL}) 0,29*`;
    expect(tokenizeInline(input)).toEqual([
      TEXT('Excel (Normalized): bernilai ', { italic: true }),
      IMG(URL, 'math_inline'),
      TEXT(' 0,29', { italic: true }),
    ]);
  });

  it('keeps multiple images inside one italic span', () => {
    const input = `*pre ![a](${URL}) mid ![b](${URL}) post*`;
    expect(tokenizeInline(input)).toEqual([
      TEXT('pre ', { italic: true }),
      IMG(URL, 'a'),
      TEXT(' mid ', { italic: true }),
      IMG(URL, 'b'),
      TEXT(' post', { italic: true }),
    ]);
  });

  it('keeps an image inside a bold span', () => {
    const input = `**lead ![x](${URL}) tail**`;
    expect(tokenizeInline(input)).toEqual([
      TEXT('lead ', { bold: true }),
      IMG(URL, 'x'),
      TEXT(' tail', { bold: true }),
    ]);
  });

  it('keeps an image inside bold-then-italic nesting', () => {
    const input = `**bold *with ![i](${URL}) image* still bold**`;
    expect(tokenizeInline(input)).toEqual([
      TEXT('bold ', { bold: true }),
      TEXT('with ', { bold: true, italic: true }),
      IMG(URL, 'i'),
      TEXT(' image', { bold: true, italic: true }),
      TEXT(' still bold', { bold: true }),
    ]);
  });

  it('does not leak base64 chars into a text token for italic-wrapped lines', () => {
    // The bug: `+`, `/`, `=` inside data URLs used to leak into text.
    const url = 'data:image/png;base64,AB+/CD==EF';
    const tokens = tokenizeInline(`*before ![m](${url}) after*`);
    for (const t of tokens) {
      if (t.kind === 'text') {
        expect(t.text).not.toContain('base64');
        expect(t.text).not.toContain('AB+/CD');
      }
    }
    expect(tokens.find((t) => t.kind === 'image')).toBeDefined();
  });
});

describe('tokenizeInline — bullet line that triggered the regression', () => {
  // Mirrors what `parseMarkdownToParagraphs` feeds into `tokenizeInline`
  // after replacing the leading "- " with "• ", italics-wrapping the
  // bullet content, and inlining two math images.
  const URL = 'data:image/png;base64,iVBORw0KGgoAAAA';

  it('emits text + image + text + image + text in order with italic preserved', () => {
    const line =
      `• *Excel (Normalized): Dihitung berdasarkan jumlah kata dibagi total kata. ` +
      `TF "asik" di Dokumen 1 bernilai ![math_inline](${URL}) 0,29. ` +
      `TF "bikin" di Dokumen 4 bernilai ![math_inline](${URL}) 0,10*.`;

    const tokens = tokenizeInline(line);
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toEqual(['text', 'text', 'image', 'text', 'image', 'text', 'text']);

    // The literal bullet glyph is outside the italic span.
    expect(tokens[0]).toEqual(TEXT('• '));
    // Everything inside the italic span carries italic=true.
    for (let i = 1; i <= 5; i++) {
      const t = tokens[i];
      if (t.kind === 'text') expect(t.italic).toBe(true);
    }
    // The trailing period after the italic close is plain text.
    expect(tokens[6]).toEqual(TEXT('.'));
    // No raw base64 leaked into any text token.
    for (const t of tokens) {
      if (t.kind === 'text') {
        expect(t.text.includes('base64')).toBe(false);
        expect(t.text.includes(URL)).toBe(false);
      }
    }
  });
});

describe('tokenizeInline — degenerate input', () => {
  it('drops empty bold and italic spans without crashing', () => {
    expect(tokenizeInline('a **** b')).toEqual([TEXT('a '), TEXT(' b')]);
    expect(tokenizeInline('a ** b')).toEqual([TEXT('a ** b')]);
  });

  it('handles a string that is just an image', () => {
    const url = 'data:image/png;base64,AAA';
    expect(tokenizeInline(`![x](${url})`)).toEqual([IMG(url, 'x')]);
  });
});
