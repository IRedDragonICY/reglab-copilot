import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  BorderStyle,
  WidthType,
} from 'docx';
import type { AIReportData, UserImage, CellAnalysis } from '@/lib/types';
import { FONT_CALIBRI, FONT_MONO, MAX_IMG_WIDTH } from './constants';
import { sanitizeText } from './text';
import { toImageRun } from './image';
import { codeLines as buildCodeLines } from './code';
import { lightBorderedTable, titledRow, contentRow } from './table';
import { parseMarkdownToParagraphs } from './markdown';
import { rasterizeHtml } from './html-raster';

/**
 * Notebook-rendering routines.
 *
 * These are the two callsites (one for user-uploaded images, one for
 * parsed Jupyter cells) that together emit the bulk of the "Implementasi"
 * section. The legacy builder kept them inside its 1.3k-line blob; moving
 * them here shrinks the orchestrator to <400 lines and lets these
 * functions grow independently.
 */

/**
 * Emit paragraphs for a sequence of user-uploaded images with numbered
 * "Gambar X.Y" captions beneath each. Skips PDFs (the AI has already
 * extracted their text) and any image whose data URL is missing.
 */
export async function createImagesParagraphs(
  images: UserImage[],
  prefix: string,
  bab: string,
  startIndex: number,
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  let index = startIndex;

  for (const img of images) {
    if (!img || !img.dataUrl) continue;
    if (img.dataUrl.startsWith('data:application/pdf')) continue;

    try {
      const run = await toImageRun(img.dataUrl, {
        maxWidth: MAX_IMG_WIDTH,
        measureFallback: { width: 400, height: 300 },
      });
      if (!run) continue;
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [run],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Gambar ${bab}.${index} ${prefix}`,
              size: 22,
              font: FONT_CALIBRI,
            }),
          ],
          spacing: { before: 100, after: 300 },
        }),
      );
      index++;
    } catch (e) {
      console.error('Failed to add user image', e);
    }
  }
  return paragraphs;
}

type NotebookCellInput = {
  cell: {
    cell_type: 'code' | 'markdown' | 'raw';
    source: string;
    outputs?: { type: 'text' | 'image' | 'html'; content: string }[];
  };
  index: number;
  notebookIndex: number;
};

/**
 * Render a sequence of Jupyter cells (already-categorized by the caller)
 * into DOCX block content. Each code cell emits a bordered multi-row
 * table (Kode Program + optional Hasil Output), its AI-generated caption,
 * a chronological set of rasterized or native image outputs, and the AI's
 * per-cell explanation.
 *
 * `startCodeIndex` / `startImageIndex` drive the per-cell numbering;
 * returns the next indexes so the caller can chain across notebooks.
 */
export async function renderNotebookCells(
  cells: NotebookCellInput[],
  aiData: AIReportData,
  chapterPrefix: string,
  startCodeIndex: number,
  startImageIndex: number,
): Promise<{ paragraphs: (Paragraph | Table)[]; nextCodeIdx: number; nextImgIdx: number }> {
  const children: (Paragraph | Table)[] = [];
  let codeIdx = startCodeIndex;
  let imgIdx = startImageIndex;

  const cellAnalysesArray: CellAnalysis[] | undefined =
    aiData.cellAnalyses ??
    (aiData as unknown as { praktikum?: { cellAnalyses?: CellAnalysis[] } }).praktikum?.cellAnalyses ??
    (aiData as unknown as { kuliah?: { cellAnalyses?: CellAnalysis[] } }).kuliah?.cellAnalyses;

  for (const { cell, index, notebookIndex } of cells) {
    if (cell.cell_type === 'markdown' && cell.source.trim()) {
      const parsedMd = await parseMarkdownToParagraphs(cell.source);
      children.push(
        lightBorderedTable([
          titledRow('Penjelasan Teks (Markdown)'),
          contentRow(parsedMd),
        ]),
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
      continue;
    }

    if (cell.cell_type !== 'code' || !cell.source.trim()) continue;

    const codeLinesParagraphs = buildCodeLines(cell.source);
    const tableRows: TableRow[] = [
      titledRow('Kode Program'),
      contentRow(codeLinesParagraphs),
    ];

    const analysis = cellAnalysesArray?.find(
      (a) => a.cellIndex === index && (a.notebookIndex === undefined || a.notebookIndex === notebookIndex),
    );
    const caption = analysis?.caption || 'Blok Kode';
    const tableCaption = analysis?.tableCaption || analysis?.caption || 'Output Visual';

    const htmlImages: Paragraph[] = [];

    if (cell.outputs) {
      for (const output of cell.outputs) {
        if (output.type === 'html' && output.content.trim()) {
          const imgData = await rasterizeHtml(output.content);
          if (imgData) {
            const htmlRun = await toImageRun(
              { buffer: imgData.buffer, measureSrc: '', forceType: 'png' },
              { maxWidth: MAX_IMG_WIDTH, preMeasured: { width: imgData.width, height: imgData.height } },
            );
            if (htmlRun) {
              htmlImages.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [htmlRun],
                }),
                new Paragraph({
                  heading: HeadingLevel.HEADING_4,
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Gambar ${chapterPrefix}.${imgIdx} ${tableCaption}`,
                      size: 22,
                      font: FONT_CALIBRI,
                    }),
                  ],
                  spacing: { before: 100, after: 300 },
                }),
              );
              imgIdx++;
            }
          } else {
            // Rasterization failed — fall back to monospace text rendering.
            const outputParagraphs = output.content.split('\n').map((line) =>
              new Paragraph({
                children: [new TextRun({ text: sanitizeText(line), font: FONT_MONO, size: 20 })],
                spacing: { line: 240 },
              }),
            );
            tableRows.push(titledRow('Hasil Output'), contentRow(outputParagraphs));
          }
        } else if (output.type === 'text' && output.content.trim()) {
          const outputParagraphs = output.content.split('\n').map((line) =>
            new Paragraph({
              children: [new TextRun({ text: sanitizeText(line), font: FONT_MONO, size: 20 })],
              spacing: { line: 240 },
            }),
          );
          tableRows.push(titledRow('Hasil Output'), contentRow(outputParagraphs));
        }
      }
    }

    // Black-bordered table — intentionally different from the light-bordered
    // markdown/html tables above. Preserves pre-refactor visual identity.
    const codeTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      },
      rows: tableRows,
    });

    children.push(codeTable);
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_5,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Kode Program ${chapterPrefix}.${codeIdx} ${caption}`,
            size: 22,
            font: FONT_CALIBRI,
          }),
        ],
        spacing: { before: 100, after: 300 },
      }),
    );

    // HTML-rasterized images follow the code caption.
    if (htmlImages.length > 0) {
      children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));
      for (const pt of htmlImages) {
        children.push(pt);
        children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));
      }
    }

    // AI analysis paragraphs.
    if (analysis?.explanation) {
      const parsedExp = await parseMarkdownToParagraphs(analysis.explanation);
      children.push(...parsedExp);
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    codeIdx++;

    // Native image outputs (e.g. matplotlib `image/png`) emit after the caption.
    if (cell.outputs) {
      for (const output of cell.outputs) {
        if (output.type !== 'image') continue;
        try {
          const cleanBase64 = output.content.replace(/[^A-Za-z0-9+/=]/g, '');
          const dataUrl = `data:image/png;base64,${cleanBase64}`;
          const nativeRun = await toImageRun(dataUrl, {
            maxWidth: MAX_IMG_WIDTH,
            measureFallback: { width: 400, height: 300 },
          });
          if (!nativeRun) continue;
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [nativeRun],
            }),
          );
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_4,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `Gambar ${chapterPrefix}.${imgIdx} ${tableCaption}`,
                  size: 22,
                  font: FONT_CALIBRI,
                }),
              ],
              spacing: { before: 100, after: 300 },
            }),
          );
          imgIdx++;
        } catch (e) {
          console.error('Failed to add image output', e);
        }
      }
    }
  }

  return { paragraphs: children, nextCodeIdx: codeIdx, nextImgIdx: imgIdx };
}
