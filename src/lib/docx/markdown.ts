import {
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { FONT_CALIBRI, MAX_IMG_WIDTH, PALETTE } from './constants';
import { sanitizeText } from './text';
import { toImageRun } from './image';
import { codeTable as buildCodeTable } from './code';
import { yieldThread } from "../utils";
import { preprocessMathToImages } from '../parser';

/**
 * Translate a loose markdown-ish string into an ordered list of DOCX
 * paragraphs and tables. This is the same hand-rolled walker the project
 * has shipped all along; extracted here so the 1k-line `docxBuilder` only
 * orchestrates higher-level section assembly.
 *
 * Supported syntax (intentionally limited — we own the emitter):
 *  - `#` heading levels (1–6) with decreasing size
 *  - `- ` bullet lines (rendered as `• `-prefixed paragraphs with indent)
 *  - `1. ` numbered lines (indented; numbering preserved inline)
 *  - `**bold**` and `*italic*` inline spans (may surround images and
 *    other styled spans — see `tokenizeInline`)
 *  - `![alt](url)` images — data URLs decoded inline, external URLs
 *    fetched (codecogs.com routed via AllOrigins for CORS)
 *  - Triple-backtick fenced code blocks → bordered shaded code tables
 *
 * Any raw HTML that slips through is stripped before the walker runs
 * so the emitter does not try to interpret it.
 */

function buildMarkdownTable(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, rIdx) => {
      const isHeader = rIdx === 0;
      return new TableRow({
        children: row.map((cellText) => {
          return new TableCell({
            children: [
               new Paragraph({
                 children: tokenizeInline(cellText.trim()).map(token => {
                   if (token.kind === 'text') {
                     return new TextRun({
                       text: sanitizeText(token.text),
                       bold: isHeader || token.bold,
                       italics: token.italic,
                       font: FONT_CALIBRI,
                       size: 22,
                     });
                   }
                   return new TextRun({ text: '[Image]' });
                 }),
                 alignment: AlignmentType.LEFT,
               })
            ],
            shading: isHeader ? { fill: 'F3F4F6' } : undefined,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          });
        })
      });
    }),
  });
}

export async function parseMarkdownToParagraphs(
  text: string,
  options?: { prefix?: string; prefixBold?: boolean },
): Promise<(Paragraph | Table)[]> {
  if (!text) return [];

  const processedText = await preprocessMathToImages(text);

  // Strip raw HTML to avoid leaking angle brackets into the output.
  let cleanText = processedText.replace(
    /<\/?(?:table|tr|td|th|tbody|thead|img|a|div|span|p|b|i|strong|em)(?:[^>]*?)>/gi,
    '',
  );

  // Repair `![alt]( data URL with newlines )` which LLMs sometimes emit.
  cleanText = cleanText.replace(
    /!\[([^\]]*)\]\s*\(([\s\S]*?)\)/g,
    (_match, alt: string, url: string) => `![${alt}](${url.replace(/\s+/g, '')})`,
  );

  const lines = cleanText.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let isFirstLine = true;

  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(buildMarkdownTable(tableRows));
      elements.push(new Paragraph({ spacing: { after: 200 } }));
      tableRows = [];
    }
    inTable = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      if (!inTable) inTable = true;
      const parts = line.trim().split('|').slice(1, -1).map(s => s.trim());
      const isSeparator = parts.length > 0 && parts.every(p => /^:?-+:?$/.test(p.replace(/\s/g, '')));
      if (!isSeparator && parts.length > 0) {
        tableRows.push(parts);
      }
      continue;
    } else {
      flushTable();
    }
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(buildCodeTable(codeBuffer.join('\n')));
        elements.push(new Paragraph({ spacing: { after: 200 } }));
        inCodeBlock = false;
        codeBuffer = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) continue;

    let textToParse = line.trim();
    let indent = 0;

    const headingMatch = textToParse.match(/^(#{1,6})\s+(.*)/);
    let isHeadingBold = false;
    let headingSize = 22;
    if (headingMatch) {
      const level = headingMatch[1].length;
      textToParse = headingMatch[2];
      isHeadingBold = true;
      headingSize = level === 1 ? 32 : level === 2 ? 28 : level === 3 ? 24 : 22;
    }

    const bulMatch = textToParse.match(/^-\s+(.*)/);
    if (bulMatch) {
      textToParse = '• ' + bulMatch[1];
      indent = 360;
    } else if (/^\d+\.\s+/.test(textToParse)) {
      indent = 360;
    }

    const tokens = tokenizeInline(textToParse);
    const textRuns: (TextRun | ImageRun)[] = [];

    if (isFirstLine && options?.prefix) {
      textRuns.push(
        new TextRun({
          text: sanitizeText(options.prefix + ' '),
          bold: options.prefixBold ?? false,
          size: headingSize,
          font: FONT_CALIBRI,
        })
      );
      isFirstLine = false;
    }
    for (const token of tokens) {
      if (token.kind === 'image') {
        const run = await renderImageToken(token.url, headingSize, isHeadingBold);
        if (run) textRuns.push(run);
        continue;
      }

      if (!token.text) continue;

      textRuns.push(
        new TextRun({
          text: sanitizeText(token.text),
          bold: token.bold || isHeadingBold,
          italics: token.italic,
          size: headingSize,
          font: FONT_CALIBRI,
        })
      );
    }
    elements.push(
      new Paragraph({
        children: textRuns,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120 },
        indent: indent ? { left: indent } : undefined,
      }),
    );
    await yieldThread();
  }

  flushTable();
  // Flush a still-open code block at EOF.
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(buildCodeTable(codeBuffer.join('\n')));
    elements.push(new Paragraph({ spacing: { after: 200 } }));
  }

  return elements;
  return elements;
}

/**
 * A single inline token produced by `tokenizeInline`.
 *  - `text` carries plain or styled text (bold/italic flags resolved).
 *  - `image` carries an image URL with no surrounding style — the docx
 *    `ImageRun` itself doesn't have a "bold" attribute, so any wrapping
 *    style is dropped on images (just like in HTML/CSS).
 */
export type InlineToken =
  | { kind: 'text'; text: string; bold: boolean; italic: boolean }
  | { kind: 'image'; url: string; alt: string };

/**
 * Split an inline markdown line into ordered tokens.
 *
 * Algorithm (in order, important):
 *  1. Extract every `![alt](url)` image into an indexed placeholder so
 *     base64 payloads, parens in URLs, and `*` chars inside data URLs
 *     can never be misread as italic delimiters. This is the bug fix
 *     for italic-wrapped lines that contain inline math images: the
 *     old flat split treated the leading `*` of the bullet/sentence as
 *     an italic open and let `*…*` swallow the entire `![…](data:…)`,
 *     leaking the base64 string as plain text into the DOCX.
 *  2. Tokenize the placeholder-bearing string for `**bold**` and
 *     `*italic*` spans using a simple linear scanner. We do not allow
 *     the same delimiter to nest inside itself, but we *do* allow
 *     italics to appear inside a bold run and vice-versa.
 *  3. Expand placeholders back into image tokens, preserving the order
 *     of text and image runs as they appeared in the source.
 *
 * Defensive choices:
 *  - Unmatched `*` or `**` are emitted as literal characters.
 *  - Empty styled spans (`**` with nothing between) are dropped.
 *  - Whitespace inside data URLs is collapsed by the caller before we
 *    see it (see `cleanText` in `parseMarkdownToParagraphs`).
 */
export function tokenizeInline(input: string): InlineToken[] {
  // ---- 1. Extract images into placeholders --------------------------------
  // Sentinels use a byte that can't appear in normal text or markdown.
  const SENTINEL = '\u0001';
  const images: { url: string; alt: string }[] = [];
  const placeheld = input.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, url: string) => {
      const idx = images.length;
      images.push({ alt, url });
      return `${SENTINEL}IMG${idx}${SENTINEL}`;
    },
  );

  // ---- 2. Tokenize bold/italic on the placeheld string --------------------
  const styledRuns = tokenizeStyledSpan(placeheld, false, false);

  // ---- 3. Expand placeholders back to image / text tokens -----------------
  const out: InlineToken[] = [];
  const placeholderRe = new RegExp(`${SENTINEL}IMG(\\d+)${SENTINEL}`, 'g');

  for (const run of styledRuns) {
    let lastIndex = 0;
    placeholderRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = placeholderRe.exec(run.text)) !== null) {
      if (match.index > lastIndex) {
        out.push({
          kind: 'text',
          text: run.text.slice(lastIndex, match.index),
          bold: run.bold,
          italic: run.italic,
        });
      }
      const imgIdx = Number(match[1]);
      const img = images[imgIdx];
      if (img) out.push({ kind: 'image', url: img.url, alt: img.alt });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < run.text.length) {
      out.push({
        kind: 'text',
        text: run.text.slice(lastIndex),
        bold: run.bold,
        italic: run.italic,
      });
    }
  }

  return out;
}

/**
 * Find the next occurrence of `delim` in `s` starting at `from`, but
 * skip occurrences that are part of a longer delimiter run.
 * Returns -1 if not found.
 */
function findClosingDelim(s: string, from: number, delim: '*' | '**' | '***'): number {
  let i = from;
  while (i < s.length) {
    if (s[i] !== '*') { i += 1; continue; }

    let runLen = 1;
    while (s[i + runLen] === '*') runLen++;

    if (delim === '***') {
      if (runLen >= 3) return i;
    } else if (delim === '**') {
      if (runLen >= 2) return i;
    } else {
      if (runLen === 1) return i;
      if (runLen >= 3) return i; // can close a single star
    }
    i += runLen;
  }
  return -1;
}

/**
 * Tokenize a styled inner span. Reuses the same scanner so nested
 * `*italic*` inside `**bold**` (and vice-versa) is supported, but we
 * carry forward the parent's bold/italic flags so the resulting runs
 * inherit the wrapping style.
 */
function tokenizeStyledSpan(
  span: string,
  parentBold: boolean,
  parentItalic: boolean,
): { text: string; bold: boolean; italic: boolean }[] {
  const out: { text: string; bold: boolean; italic: boolean }[] = [];
  let i = 0;
  let buffer = '';
  let bold = parentBold;
  let italic = parentItalic;

  const flush = () => {
    if (!buffer) return;
    out.push({ text: buffer, bold, italic });
    buffer = '';
  };

  while (i < span.length) {
    const ch = span[i];
    if (ch === '*') {
      let runLen = 1;
      while (span[i + runLen] === '*') runLen++;

      let delimLength = runLen >= 3 ? 3 : runLen;
      let delim = delimLength === 3 ? '***' : delimLength === 2 ? '**' : '*';

      let searchFrom = i + runLen;
      let closeAt = findClosingDelim(span, searchFrom, delim as any);

      if (closeAt === -1 && delim === '***') {
        delimLength = 2;
        delim = '**';
        closeAt = findClosingDelim(span, searchFrom, delim as any);
      }

      if (closeAt === -1 && delim === '**') {
        delimLength = 1;
        delim = '*';
        closeAt = findClosingDelim(span, searchFrom, delim as any);
      }

      if (closeAt === -1) {
        buffer += delim;
        i += delimLength;
        continue;
      }

      flush();
      const isTriple = delim === '***';
      const isDouble = delim === '**';

      if (isTriple) { bold = true; italic = true; }
      else if (isDouble) { bold = true; }
      else { italic = true; }

      const inner = span.slice(i + delimLength, closeAt);
      out.push(...tokenizeStyledSpan(inner, bold, italic));

      if (isTriple) { bold = parentBold; italic = parentItalic; }
      else if (isDouble) { bold = parentBold; }
      else { italic = parentItalic; }

      i = closeAt + delimLength;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

/**
 * Render a single image URL extracted from inline markdown. Returns an
 * `ImageRun` on success, a red `[Image/Math Render Error]` `TextRun` for
 * decode failures on data URLs, or `null` for silent external-URL fetch
 * failures (matches pre-refactor behavior).
 */
async function renderImageToken(
  url: string,
  headingSize: number,
  isHeadingBold: boolean,
): Promise<TextRun | ImageRun | null> {
  try {
    const run = await toImageRun(url, {
      maxWidth: MAX_IMG_WIDTH,
      halfScale: true,
      minSize: { width: 100, height: 16 },
      measureFallback: { width: 0, height: 0 },
    });
    if (run) return run;
    if (url.startsWith('data:image/')) {
      return new TextRun({
        text: sanitizeText('[Image/Math Render Error]'),
        size: headingSize,
        font: FONT_CALIBRI,
        color: PALETTE.errorText,
        bold: isHeadingBold,
      });
    }
    return null;
  } catch (e) {
    console.error('Base64/Image render error:', e);
    return new TextRun({
      text: sanitizeText('[Image/Math Render Error]'),
      size: headingSize,
      font: FONT_CALIBRI,
      color: PALETTE.errorText,
      bold: isHeadingBold,
    });
  }
}
