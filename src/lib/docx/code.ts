import { Paragraph, TextRun, Table } from 'docx';
import { FONT_MONO, PALETTE } from './constants';
import { highlightPythonLine } from '../syntaxHighlighter';
import { lightBorderedTable, titledRow, contentRow } from './table';

/**
 * Code-block primitives for the DOCX builder.
 *
 * The legacy builder had three near-identical implementations of "turn a
 * source string into line-numbered syntax-highlighted paragraphs, wrap in
 * a bordered single-cell table with a shaded background". They all route
 * through {@link codeTable} now.
 */

/**
 * Build the line-numbered syntax-highlighted paragraphs for one source
 * string. Lines are split on `\n`; blank lines are preserved.
 */
export function codeLines(source: string): Paragraph[] {
  const lines = source.split('\n');
  return lines.map((line, idx) => {
    const lineNumStr = String(idx + 1).padStart(3, ' ') + ' | ';
    return new Paragraph({
      children: [
        new TextRun({
          text: lineNumStr,
          font: FONT_MONO,
          size: 20,
          color: PALETTE.lineNumber,
        }),
        ...highlightPythonLine(line),
      ],
      indent: { left: 450, hanging: 450 },
      spacing: { line: 240 },
    });
  });
}

/**
 * Wrap a source string in a light-bordered single-cell table with the
 * neutral code-shade background. When `title` is provided the table has
 * two rows (title + body); otherwise just the body row.
 *
 * `shading` overrides the default code-shade; pass `null` to disable.
 */
export function codeTable(
  source: string,
  opts: { title?: string; shading?: string | null } = {},
): Table {
  const bodyParagraphs = codeLines(source);
  const shade = opts.shading === null ? undefined : opts.shading ?? PALETTE.codeShade;

  const rows = [];
  if (opts.title) rows.push(titledRow(opts.title));
  rows.push(contentRow(bodyParagraphs, shade ? { shading: shade } : {}));

  return lightBorderedTable(rows);
}
