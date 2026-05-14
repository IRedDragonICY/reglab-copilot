import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  BorderStyle,
  WidthType,
} from 'docx';
import { FONT_CALIBRI, PALETTE } from './constants';

/**
 * DOCX table primitives.
 *
 * These replace the several copies of inline `new Table({ borders: {...} })`
 * and `new TableRow({...})` constructions that proliferated across the
 * legacy `docxBuilder.ts`. Every flat-bordered table the builder emits now
 * routes through one of these helpers.
 */

const SINGLE_1PX = { style: BorderStyle.SINGLE, size: 1 } as const;

/** Four-sided light-gray border used by the code and output tables. */
const LIGHT_BORDERS = {
  top: { ...SINGLE_1PX, color: PALETTE.borderLight },
  bottom: { ...SINGLE_1PX, color: PALETTE.borderLight },
  left: { ...SINGLE_1PX, color: PALETTE.borderLight },
  right: { ...SINGLE_1PX, color: PALETTE.borderLight },
  insideHorizontal: { ...SINGLE_1PX, color: PALETTE.borderLight },
  insideVertical: { ...SINGLE_1PX, color: PALETTE.borderLight },
} as const;

/** Default interior padding used by content cells. */
const CELL_PAD = { top: 100, bottom: 100, left: 100, right: 100 } as const;
const TITLE_PAD = { top: 50, bottom: 50, left: 100, right: 100 } as const;

/**
 * Build a 100%-width, flat-bordered Table (`E5E7EB` borders, 1px) from rows.
 * Callers that need custom borders should construct a `Table` directly.
 */
export function lightBorderedTable(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: LIGHT_BORDERS,
    rows,
  });
}

/**
 * A single-cell row used as a section title inside multi-row tables.
 * Example usage: "Kode Program", "Hasil Output", "Cell Penjelasan".
 *
 * `shade` defaults to the neutral title shade; pass `PALETTE.explainShade`
 * for the AI-analysis rows to preserve legacy coloring.
 */
export function titledRow(title: string, shade: string = PALETTE.titleShade): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, font: FONT_CALIBRI, size: 20 })],
            spacing: { before: 50, after: 50 },
          }),
        ],
        shading: { fill: shade },
        margins: TITLE_PAD,
      }),
    ],
  });
}

/**
 * A single-cell content row. The caller provides the already-constructed
 * paragraphs; this helper enforces consistent margins and (optional) shading.
 */
export function contentRow(
  children: Paragraph[] | (Paragraph | Table)[],
  opts: { shading?: string } = {},
): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: children.length > 0 ? (children as Paragraph[]) : [new Paragraph({ text: '' })],
        margins: CELL_PAD,
        ...(opts.shading ? { shading: { fill: opts.shading } } : {}),
      }),
    ],
  });
}
