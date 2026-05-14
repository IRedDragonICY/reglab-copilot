import {
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  Table,
} from 'docx';
import { FONT_CALIBRI, MAX_IMG_WIDTH, PALETTE } from './constants';
import { sanitizeText } from './text';
import { toImageRun } from './image';
import { codeTable as buildCodeTable } from './code';
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
 *  - `**bold**` and `*italic*` inline spans
 *  - `![alt](url)` images — data URLs decoded inline, external URLs
 *    fetched (codecogs.com routed via AllOrigins for CORS)
 *  - Triple-backtick fenced code blocks → bordered shaded code tables
 *
 * Any raw HTML that slips through is stripped before the walker runs
 * so the emitter does not try to interpret it.
 */
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

  for (const line of lines) {
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

    // Ensure an image span isn't eaten by bold/italic regex.
    textToParse = textToParse.replace(/\*\*(!\[[^\]]*\]\s*\([^)]+\))\*\*/g, '$1');
    textToParse = textToParse.replace(/\*(!\[[^\]]*\]\s*\([^)]+\))\*/g, '$1');

    // Split so image spans get priority over bold/italic.
    const parts = textToParse.split(/(!\[[^\]]*\]\s*\([^)]+\)|\*\*.*?\*\*|\*.*?\*)/g);
    const textRuns: (TextRun | ImageRun)[] = [];

    if (isFirstLine && options?.prefix) {
      textRuns.push(
        new TextRun({
          text: sanitizeText(options.prefix + ' '),
          bold: options.prefixBold ?? false,
          size: headingSize,
          font: FONT_CALIBRI,
        }),
      );
      isFirstLine = false;
    }

    for (const part of parts) {
      if (!part) continue;

      if (part.startsWith('![') && /\]\s*\(/.test(part)) {
        const urlMatch = part.match(/\]\s*\(([^)]+)\)/);
        if (urlMatch) {
          const url = urlMatch[1];
          try {
            const run = await toImageRun(url, {
              maxWidth: MAX_IMG_WIDTH,
              halfScale: true,
              minSize: { width: 100, height: 16 },
              measureFallback: { width: 0, height: 0 },
            });
            if (run) {
              textRuns.push(run);
            } else if (url.startsWith('data:image/')) {
              // Data-URL decode failure — preserve the legacy error placeholder.
              textRuns.push(
                new TextRun({
                  text: sanitizeText('[Image/Math Render Error]'),
                  size: headingSize,
                  font: FONT_CALIBRI,
                  color: PALETTE.errorText,
                  bold: isHeadingBold,
                }),
              );
            }
            // External URL fetch failure is silently skipped (pre-refactor behavior).
          } catch (e) {
            console.error('Base64/Image render error:', e);
            textRuns.push(
              new TextRun({
                text: sanitizeText('[Image/Math Render Error]'),
                size: headingSize,
                font: FONT_CALIBRI,
                color: PALETTE.errorText,
                bold: isHeadingBold,
              }),
            );
          }
        } else {
          textRuns.push(
            new TextRun({
              text: sanitizeText(part),
              size: headingSize,
              font: FONT_CALIBRI,
              bold: isHeadingBold,
            }),
          );
        }
      } else if (part.startsWith('**') && part.endsWith('**')) {
        textRuns.push(
          new TextRun({
            text: sanitizeText(part.slice(2, -2)),
            bold: true,
            size: headingSize,
            font: FONT_CALIBRI,
          }),
        );
      } else if (part.startsWith('*') && part.endsWith('*')) {
        textRuns.push(
          new TextRun({
            text: sanitizeText(part.slice(1, -1)),
            italics: true,
            size: headingSize,
            font: FONT_CALIBRI,
            bold: isHeadingBold,
          }),
        );
      } else {
        textRuns.push(
          new TextRun({
            text: sanitizeText(part),
            size: headingSize,
            font: FONT_CALIBRI,
            bold: isHeadingBold,
          }),
        );
      }
    }

    elements.push(
      new Paragraph({
        children: textRuns,
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120 },
        indent: indent ? { left: indent } : undefined,
      }),
    );
  }

  // Flush a still-open code block at EOF.
  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(buildCodeTable(codeBuffer.join('\n')));
    elements.push(new Paragraph({ spacing: { after: 200 } }));
  }

  return elements;
}
