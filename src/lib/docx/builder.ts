import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ImageRun,
  PageBreak,
  TableOfContents,
  Footer,
  Header,
  PageNumber,
  SectionType,
  NumberFormat,
  ExternalHyperlink,
  UnderlineType,
} from 'docx';
import { ParsedNotebook, categorizeNotebookCells } from '../parser';
import { getFormattedJudulPertemuan, type ReportMetadata, type AIReportData, type UserImage } from '@/lib/types';
import { CM_TO_TWIP } from './constants';
import { sanitizeText } from './text';
import { parseMarkdownToParagraphs } from './markdown';
import { createImagesParagraphs, renderNotebookCells, findUnanalyzedImages, renderOrphanImages } from './notebook';
import { yieldThread } from '../utils';

// Re-export so existing consumers of `@/lib/docxBuilder` keep working.
// Canonical definitions live in `@/lib/types` and the helpers in `./docx/*`.
export type { ReportMetadata, AIReportData, UserImage };
export { sanitizeText } from './text';
export { parseMarkdownToParagraphs } from './markdown';

export async function generateDocx(
  metadata: ReportMetadata,
  notebooks: (ParsedNotebook | null)[],
  aiData: AIReportData,
  logoBlob: Blob | null,
  preTestImages: UserImage[] = [],
  implImages: UserImage[] = [],
  postTestImages: UserImage[] = [],
  modulContext: string = '',
  postTest: string = '',
  numImplNotebooks: number = notebooks.length,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  if (onProgress) onProgress("Membangun cover halaman...");
  const isKuliah = metadata.reportType === 'kuliah';
  const coverChildren: any[] = [];
  const frontChildren: any[] = [];
  const bodyChildren: any[] = [];

  coverChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: isKuliah ? 'LAPORAN KULIAH' : 'LAPORAN PRAKTIKUM', bold: true, size: 28, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: sanitizeText(metadata.mataPraktikum), bold: true, size: 28, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: isKuliah ? 'Topik' : 'Materi', bold: true, size: 28, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: sanitizeText(getFormattedJudulPertemuan(metadata)), bold: true, size: 28, font: 'Calibri' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ 
          text: sanitizeText(metadata.laboratorium ? `${metadata.hariTanggalSesi} Lab. ${metadata.laboratorium}` : metadata.hariTanggalSesi), 
          bold: true, 
          size: 28, 
          font: 'Calibri' 
        }),
      ],
    })
  );

  for (let i = 0; i < 5; i++) {
    coverChildren.push(new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }));
  }

  if (logoBlob) {
    try {
      const arrayBuffer = await logoBlob.arrayBuffer();
      coverChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: arrayBuffer,
              transformation: {
                 width: 189,
                 height: 189,
              },
              type: 'png',
            }),
          ],
        })
      );
    } catch (e) {
      console.error('Failed to parse logo blob', e);
    }
  }

  for (let i = 0; i < 5; i++) {
    coverChildren.push(new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }));
  }

  coverChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Dosen Pengampu:', bold: true, size: 24, font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: sanitizeText(metadata.dosen || ''), size: 24, font: 'Calibri' })],
    }),
    new Paragraph({ text: '', spacing: { before: 200, after: 200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Disusun Oleh:', bold: true, size: 24, font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: sanitizeText(metadata.nama), size: 24, font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: sanitizeText(metadata.nim), size: 24, font: 'Calibri' })],
    }),
    new Paragraph({ text: '', spacing: { before: 800, after: 800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'PROGRAM STUDI S1 INFORMATIKA', bold: true, size: 28, font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'FAKULTAS TEKNOLOGI INDUSTRI', bold: true, size: 28, font: 'Calibri' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'UNIVERSITAS AHMAD DAHLAN', bold: true, size: 28, font: 'Calibri' })],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: new Date().getFullYear().toString(), bold: true, size: 28, font: 'Calibri' })],
    })
  );

  if (onProgress) onProgress("Membangun bab pendahuluan...");
  frontChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DAFTAR ISI', bold: true, size: 22, font: 'Calibri', color: '000000' })],
      spacing: { after: 400 },
    }),
    new TableOfContents("Daftar Isi", {
        hyperlink: true,
        headingStyleRange: "1-3",
        beginDirty: true,
    }),
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  frontChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DAFTAR GAMBAR', bold: true, size: 22, font: 'Calibri', color: '000000' })],
      spacing: { after: 400 },
    }),
    new TableOfContents("Daftar Gambar", {
        hyperlink: true,
        headingStyleRange: "4-4",
        beginDirty: true,
    }),
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  frontChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'DAFTAR KODE PROGRAM', bold: true, size: 22, font: 'Calibri', color: '000000' })],
      spacing: { after: 400 },
    }),
    new TableOfContents("Daftar Kode Program", {
        hyperlink: true,
        headingStyleRange: "5-5",
        beginDirty: true,
    }),
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  const notebookLinks: string[] = [];
  const postTestNotebookLinks: string[] = [];
  const notebookLinkRegex = /https:\/\/(colab\.research\.google\.com|www\.kaggle\.com)\/[^\s]+/g;

  if (modulContext) {
    const matches = modulContext.match(notebookLinkRegex);
    if (matches) {
       matches.forEach(link => {
         if (!notebookLinks.includes(link)) notebookLinks.push(link);
       });
    }
  }

  if (postTest) {
    const matches = postTest.match(notebookLinkRegex);
    if (matches) {
       matches.forEach(link => {
         if (!postTestNotebookLinks.includes(link)) postTestNotebookLinks.push(link);
       });
    }
  }

  const cellAnalysesArray = aiData.cellAnalyses || (aiData as any).praktikum?.cellAnalyses || (aiData as any).kuliah?.cellAnalyses;
  const preTestAnswersArray = aiData.preTestAnswers || ((aiData as any).pre_test?.questions || []).map((q: string, i: number) => ({ q, a: (aiData as any).pre_test?.answers?.[i] || '' }));
  const postTestAnswersArray = aiData.postTestAnswers || ((aiData as any).post_test?.questions || []).map((q: string, i: number) => ({ q, a: (aiData as any).post_test?.answers?.[i] || '' }));
  const narrative = aiData.stepByStepNarrative || (aiData as any).praktikum?.langkah_kerja || '';
  const cAnalysis = aiData.codeAnalysis || (aiData as any).praktikum?.analisis_hasil || (aiData as any).kuliah?.analisis_hasil || '';
  const pendahuluanText = aiData.pendahuluan || (aiData as any).kuliah?.pendahuluan || '';

  if (!isKuliah) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'I. Pre Test', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { after: 200 },
      })
    );

    const preTestAnswersArrayList = preTestAnswersArray || [];
    for (let index = 0; index < preTestAnswersArrayList.length; index++) {
      const item = preTestAnswersArrayList[index];
      if (!item.q || item.q.trim() === '-' || item.q.trim() === '') continue;

      const num = index + 1;
      const cleanQ = item.q.replace(/^[A-Z\d]+\.\s*/i, '');
      bodyChildren.push(...(await parseMarkdownToParagraphs(cleanQ, { prefix: `${num}.`, prefixBold: true })));
      bodyChildren.push(...(await parseMarkdownToParagraphs(`Jawaban:\n${item.a}`, { prefix: ``, prefixBold: false })));
    }
    
    if (preTestImages.length > 0) {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Berikut adalah lampiran gambar lembar jawaban Pre-Test yang dikerjakan:", size: 22, font: 'Calibri' })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 200, after: 100 },
        })
      );
      const preTestImgParagraphs = await createImagesParagraphs(preTestImages, 'Lembar Jawaban Pre-Test', 'I', 1);
      bodyChildren.push(...preTestImgParagraphs);
    }
  } else {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'BAB I', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'PENDAHULUAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],
        spacing: { before: 400, after: 200 },
      })
    );
    if (pendahuluanText) {
      bodyChildren.push(...(await parseMarkdownToParagraphs(pendahuluanText)));
    } else if (modulContext) {
      bodyChildren.push(...(await parseMarkdownToParagraphs(modulContext)));
    }
  }

  if (!isKuliah) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'II. Hasil Praktikum', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { before: 400, after: 200 },
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'A. Alat dan Bahan', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { after: 100 },
      })
    );

    const alatDanBahanList = aiData.alatDanBahan && aiData.alatDanBahan.length > 0 
      ? aiData.alatDanBahan 
      : ['Komputer / Laptop', 'Google Colab / Jupyter Notebook / Software Terkait'];

    alatDanBahanList.forEach((alat, idx) => {
      const cleanAlat = alat.replace(/^\d+\.\s*/, '');
      bodyChildren.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: sanitizeText(`${idx + 1}. ${cleanAlat}`), size: 22, font: 'Calibri' })],
          indent: { left: 360, hanging: 360 },
          spacing: { after: idx === alatDanBahanList.length - 1 ? 200 : 0 },
        })
      );
    });

    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'B. Langkah Kerja', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { after: 100 },
      })
    );

    bodyChildren.push(...(await parseMarkdownToParagraphs(narrative)));
  } else {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'BAB II', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'PEMBAHASAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],
        spacing: { before: 400, after: 200 },
      })
    );
  }

  if (notebookLinks.length > 0) {
    bodyChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'Link Notebook:', bold: true, size: 22, font: 'Calibri' })],
        spacing: { before: 200, after: 100 },
      })
    );
    notebookLinks.forEach(link => {
       bodyChildren.push(
         new Paragraph({
           children: [
             new ExternalHyperlink({
               children: [new TextRun({ text: link, style: "Hyperlink", size: 22, font: 'Calibri', color: '0000FF', underline: { type: UnderlineType.SINGLE } })],
               link: link,
             }),
           ],
           indent: { left: 360 },
           spacing: { after: 100 },
         })
       );
    });
  }

  if (!isKuliah) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'C. Implementasi/Screenshot', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { after: 200 },
      })
    );
  }

  let implCodeIndex = 1;
  let implImageIndex = 1;

  for (let nbIdx = 0; nbIdx < notebooks.length; nbIdx++) {
    if (onProgress) onProgress(`Memproses implementasi dari file ke-${nbIdx + 1}...`);
    const notebook = notebooks[nbIdx];
    if (notebook) {
      const sections = categorizeNotebookCells(notebook, nbIdx, cellAnalysesArray || []);
      const implCells = notebook.cells.map((c, i) => ({ cell: c, index: i, notebookIndex: nbIdx })).filter(item => {
        if (nbIdx >= numImplNotebooks) return false;
        if (isKuliah) return true;
        return sections[item.index] === 'implementasi';
      });

      const renderedImpl = await renderNotebookCells(implCells, aiData, 'II', implCodeIndex, implImageIndex);
      bodyChildren.push(...renderedImpl.paragraphs);
      implCodeIndex = renderedImpl.nextCodeIdx;
      implImageIndex = renderedImpl.nextImgIdx;
    }
    await yieldThread();
  }

  const usedImplImages = new Set<number>();
  if (cellAnalysesArray) {
    for (const analysis of cellAnalysesArray) {
      if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
        usedImplImages.add(analysis.imageIndex);
      }
    }
  }

  if (Array.isArray(cAnalysis)) {
    for (const item of cAnalysis) {
      if (item.imageIndex !== undefined) {
        usedImplImages.add(item.imageIndex);
      }
    }
  }

  if (cellAnalysesArray) {
    for (const analysis of cellAnalysesArray) {
      if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
        const img = implImages[analysis.imageIndex];
        if (img) {
          bodyChildren.push(
            new Paragraph({
              children: [new TextRun({ text: String(analysis.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
              spacing: { before: 200, after: 100 },
            })
          );
          
          const imgParagraphs = await createImagesParagraphs([img], String(analysis.caption).replace(/['"]/g, ''), 'II', implImageIndex);
          bodyChildren.push(...imgParagraphs);
          implImageIndex++;

          bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
        }
      }
      await yieldThread();
    }
  }
  
  const unusedImplImages = implImages.filter((_, idx) => !usedImplImages.has(idx));
  if (unusedImplImages.length > 0) {
    const orphans = findUnanalyzedImages(
      implImages,
      usedImplImages,
      'implementasi',
      'Implementasi',
    );
    const rendered = await renderOrphanImages(implImages, orphans, 'II', implImageIndex);
    bodyChildren.push(...rendered.paragraphs);
    implImageIndex = rendered.nextImgIdx;
  }

  const renderCAnalysis = async (cAnalysisData: any, prefix: string, startIdx: number) => {
    let currentIdx = startIdx;
    const elements: any[] = [];
    if (Array.isArray(cAnalysisData)) {
      for (const item of cAnalysisData) {
        if (item.imageIndex !== undefined && implImages[item.imageIndex]) {
          const img = implImages[item.imageIndex];
          usedImplImages.add(item.imageIndex);
          if (item.caption) {
            elements.push(
              new Paragraph({
                children: [new TextRun({ text: String(item.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
                spacing: { before: 200, after: 100 },
              })
            );
          }
          const imgParagraphs = await createImagesParagraphs([img], String(item.caption || 'Output Visual').replace(/['"]/g, ''), prefix, currentIdx++);
          elements.push(...imgParagraphs);
        }
        if (item.teks) {
          elements.push(...(await parseMarkdownToParagraphs(item.teks)));
        }
      }
    } else if (typeof cAnalysisData === 'string' && cAnalysisData.trim()) {
      elements.push(...(await parseMarkdownToParagraphs(cAnalysisData)));
    }
    return { elements, nextIdx: currentIdx };
  };

  if (!isKuliah) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'D. Analisis Hasil', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { before: 200, after: 100 },
      })
    );
    const { elements, nextIdx } = await renderCAnalysis(cAnalysis, 'II', implImageIndex);
    bodyChildren.push(...elements);
    implImageIndex = nextIdx;

    if (typeof aiData.ulasanPraktikum === 'string' && aiData.ulasanPraktikum.trim() !== '') {
      bodyChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'E. Ulasan Praktikum', bold: true, size: 22, font: 'Calibri', color: '000000' })],
          spacing: { before: 200, after: 100 },
        })
      );
      bodyChildren.push(...(await parseMarkdownToParagraphs(aiData.ulasanPraktikum)));
    }
  } else {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'BAB III', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'KESIMPULAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],
        spacing: { before: 400, after: 200 },
      })
    );
    let kesimpulanImageIndex = 1;
    const { elements } = await renderCAnalysis(cAnalysis, 'III', kesimpulanImageIndex);
    bodyChildren.push(...elements);
  }

  if (!isKuliah) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: 'III. Post Test', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { before: 400, after: 200 },
      })
    );

    const postTestAnswersArrayList = postTestAnswersArray || [];
    for (let index = 0; index < postTestAnswersArrayList.length; index++) {
      const item = postTestAnswersArrayList[index];
      if (!item.q || item.q.trim() === '-' || item.q.trim() === '') continue;

      const num = index + 1;
      const cleanQ = item.q.replace(/^[A-Z\d]+\.\s*/i, '');
      bodyChildren.push(...(await parseMarkdownToParagraphs(cleanQ, { prefix: `${num}.`, prefixBold: true })));
      bodyChildren.push(...(await parseMarkdownToParagraphs(`Jawaban:\n${item.a}`, { prefix: ``, prefixBold: false })));
    }

    if (postTestNotebookLinks.length > 0) {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: 'Link Notebook Post-Test:', bold: true, size: 22, font: 'Calibri' })],
          spacing: { before: 200, after: 100 },
        })
      );
      postTestNotebookLinks.forEach(link => {
         bodyChildren.push(
           new Paragraph({
             children: [
               new ExternalHyperlink({
                 children: [new TextRun({ text: link, style: "Hyperlink", size: 22, font: 'Calibri', color: '0000FF', underline: { type: UnderlineType.SINGLE } })],
                 link: link,
               }),
             ],
             indent: { left: 360 },
             spacing: { after: 100 },
           })
         );
      });
    }

    let postTestCodeIndex = 1;
    let postTestImageIndex = 1;
    let hasRenderedPostTestIntroduction = false;

    for (let nbIdx = 0; nbIdx < notebooks.length; nbIdx++) {
      const notebook = notebooks[nbIdx];
      if (notebook) {
        const sections = categorizeNotebookCells(notebook, nbIdx, cellAnalysesArray || []);
        const postTestCells = notebook.cells.map((c, i) => ({ cell: c, index: i, notebookIndex: nbIdx })).filter(item => {
          if (nbIdx >= numImplNotebooks) return true;
          return sections[item.index] === 'post_test';
        });

        if (postTestCells.length > 0) {
          if (!hasRenderedPostTestIntroduction) {
             bodyChildren.push(
               new Paragraph({
                 children: [new TextRun({ text: "Berikut adalah hasil dan analisis implementasi program yang dikerjakan pada sesi Post-Test:", size: 22, font: 'Calibri' })],
                 alignment: AlignmentType.JUSTIFIED,
                 spacing: { before: 200, after: 100 },
               })
             );
             hasRenderedPostTestIntroduction = true;
          }
          
          const renderedPostTest = await renderNotebookCells(postTestCells, aiData, 'III', postTestCodeIndex, postTestImageIndex);
          bodyChildren.push(...renderedPostTest.paragraphs);
          postTestCodeIndex = renderedPostTest.nextCodeIdx;
          postTestImageIndex = renderedPostTest.nextImgIdx;
        }
      }
      await yieldThread();
    }
    
    const usedPostTestImages = new Set<number>();
    if (cellAnalysesArray) {
      for (const analysis of cellAnalysesArray) {
        if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
          const img = postTestImages[analysis.imageIndex];
          if (img) {
            usedPostTestImages.add(analysis.imageIndex);
            bodyChildren.push(
              new Paragraph({
                children: [new TextRun({ text: String(analysis.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
                spacing: { before: 200, after: 100 },
              })
            );
            
            const imgParagraphs = await createImagesParagraphs([img], String(analysis.caption).replace(/['"]/g, ''), 'III', postTestImageIndex);
            bodyChildren.push(...imgParagraphs);
            postTestImageIndex++;

            bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
          }
        }
      }
    }
      await yieldThread();

    const unusedPostTestImages = postTestImages.filter((_, idx) => !usedPostTestImages.has(idx));
    if (unusedPostTestImages.length > 0) {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Berikut adalah lampiran gambar lembar jawaban Post-Test yang dikerjakan:", size: 22, font: 'Calibri' })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 200, after: 100 },
        })
      );
      const orphans = findUnanalyzedImages(
        postTestImages,
        usedPostTestImages,
        'post_test',
        'Lembar Jawaban Post-Test',
      );
      const rendered = await renderOrphanImages(postTestImages, orphans, 'III', postTestImageIndex);
      bodyChildren.push(...rendered.paragraphs);
      postTestImageIndex = rendered.nextImgIdx;
    }
  }

  const createHeader = () => new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: sanitizeText(metadata.nama) || 'Nama Mahasiswa',
            font: 'Calibri',
            size: 20,
          }),
        ],
      }),
    ],
  });

  const createFooter = () => new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: 'Calibri',
            size: 20,
          }),
        ],
      }),
    ],
  });

  const pageMargin = {
    top: 3 * CM_TO_TWIP,
    bottom: 3 * CM_TO_TWIP,
    left: 3 * CM_TO_TWIP,
    right: 3 * CM_TO_TWIP,
  };

  if (onProgress) onProgress("Merender dokumen final...");
  const doc = new Document({
    features: {
        updateFields: true,
    },
    styles: {
      paragraphStyles: [
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Calibri",
            size: 20,
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 300 },
            outlineLevel: 4,
          },
        },
        {
          id: "Heading5",
          name: "Heading 5",
          basedOn: "Normal",
          next: "Normal",
          run: {
            font: "Calibri",
            size: 20,
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 300 },
            outlineLevel: 5,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: pageMargin,
          },
        },
        children: coverChildren,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: pageMargin,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.UPPER_ROMAN,
            },
          },
        },
        headers: { default: createHeader() },
        footers: { default: createFooter() },
        children: frontChildren,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            margin: pageMargin,
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: { default: createHeader() },
        footers: { default: createFooter() },
        children: bodyChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
