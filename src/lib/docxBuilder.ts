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
import { ParsedNotebook, categorizeNotebookCells, preprocessMathToImages } from './parser';
import { highlightPythonLine } from './syntaxHighlighter';

export interface ReportMetadata {
  reportType?: 'praktikum' | 'kuliah';
  mataPraktikum: string;
  judulPertemuan: string;
  hariTanggalSesi: string;
  nama: string;
  nim: string;
  laboratorium?: string;
  dosen?: string;
  pertemuan?: number;
}

export interface AIReportData {
  pendahuluan?: string;
  preTestAnswers: { q: string; a: string }[];
  postTestAnswers: { q: string; a: string }[];
  stepByStepNarrative: string;
  codeAnalysis: string;
  alatDanBahan?: string[];
  cellAnalyses?: {
    cellIndex?: number;
    imageIndex?: number;
    section: 'implementasi' | 'post_test';
    caption: string;
    explanation: string;
    tableCaption?: string;
  }[];
}

export interface UserImage {
  id: string;
  dataUrl: string;
}

const CM_TO_TWIP = 567; // 1 cm = 567 twips

export function sanitizeText(text: string): string {
  if (!text) return '';
  let clean = text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean;
}

export async function parseMarkdownToParagraphs(text: string, options?: { prefix?: string, prefixBold?: boolean }): Promise<(Paragraph | Table)[]> {
  if (!text) return [];
  const processedText = await preprocessMathToImages(text);
  
  // Strip raw HTML tags to prevent messy output
  let cleanText = processedText.replace(/<\/?(?:table|tr|td|th|tbody|thead|img|a|div|span|p|b|i|strong|em)(?:[^>]*?)>/gi, '');
  
  // FIX: Pre-process super kuat untuk merajut kembali Base64 URL yang diputus line-break (\n)
  cleanText = cleanText.replace(/!\[([^\]]*)\]\s*\(([\s\S]*?)\)/g, (match, alt, url) => {
      return `![${alt}](${url.replace(/\s+/g, '')})`;
  });

  const lines = cleanText.split('\n');
  const elements: (Paragraph | Table)[] = [];
  let isFirstLine = true;

  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        const codeParagraphs = codeLines.map((cLine: string, idx: number) => {
          const lineNumStr = String(idx + 1).padStart(3, ' ') + ' | ';
          return new Paragraph({
            children: [
               new TextRun({ text: lineNumStr, font: 'Courier New', size: 20, color: '6B7280' }),
               ...highlightPythonLine(cLine)
            ],
            indent: { left: 450, hanging: 450 },
            spacing: { line: 240 },
          });
        });

        const codeTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: codeParagraphs.length > 0 ? codeParagraphs : [new Paragraph({ text: '' })],
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  shading: { fill: 'F9FAFB' }
                }),
              ],
            }),
          ],
        });
        
        elements.push(codeTable);
        elements.push(new Paragraph({ spacing: { after: 200 } })); 
        
        inCodeBlock = false;
        codeLines = [];
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) continue;

    let textToParse = line.trim();
    let indent = 0;
    
    const headingMatch = textToParse.match(/^(#{1,6})\s+(.*)/);
    let headingLevel = 0;
    let isHeadingBold = false;
    let headingSize = 22;
    if (headingMatch) {
       headingLevel = headingMatch[1].length;
       textToParse = headingMatch[2];
       isHeadingBold = true;
       headingSize = headingLevel === 1 ? 32 : (headingLevel === 2 ? 28 : (headingLevel === 3 ? 24 : 22));
    }

    const bulMatch = textToParse.match(/^-\s+(.*)/);
    if (bulMatch) {
      textToParse = "• " + bulMatch[1];
      indent = 360;
    } else if (/^\d+\.\s+/.test(textToParse)) {
      indent = 360;
    }

    // FIX: Lepaskan gambar dari jeratan bold/italic agar tidak termakan oleh regex style
    textToParse = textToParse.replace(/\*\*(!\[[^\]]*\]\s*\([^)]+\))\*\*/g, '$1');
    textToParse = textToParse.replace(/\*(!\[[^\]]*\]\s*\([^)]+\))\*/g, '$1');

    // FIX: Memprioritaskan deteksi Gambar (!) sebelum Italic/Bold
    const parts = textToParse.split(/(!\[[^\]]*\]\s*\([^)]+\)|\*\*.*?\*\*|\*.*?\*)/g);
    const textRuns: (TextRun | ImageRun)[] = [];

    if (isFirstLine && options?.prefix) {
      textRuns.push(new TextRun({ 
        text: sanitizeText(options.prefix + " "), 
        bold: options.prefixBold ?? false, 
        size: headingSize, 
        font: 'Calibri' 
      }));
      isFirstLine = false;
    }

    for (const part of parts) {
      if (!part) continue;

      if (part.startsWith('![') && /\]\s*\(/.test(part)) {
        const urlMatch = part.match(/\]\s*\(([^)]+)\)/);
        if (urlMatch) {
            const url = urlMatch[1];
            try {
                if (url.startsWith('data:image/')) {
                    const mimeMatch = url.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,/i);
                    const mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'png';
                    const imgType = (mime === 'jpeg' || mime === 'jpg') ? 'jpg' : (mime === 'gif' ? 'gif' : (mime === 'bmp' ? 'bmp' : 'png'));
                    
                    const base64Data = url.split(',')[1];
                    let cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
                    
                    const padLength = 4 - (cleanBase64.length % 4);
                    if (padLength !== 4) {
                        cleanBase64 += '='.repeat(padLength);
                    }

                    const binaryString = atob(cleanBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let j = 0; j < binaryString.length; j++) {
                        bytes[j] = binaryString.charCodeAt(j);
                    }

                    const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
                        const img = new globalThis.Image();
                        img.onload = () => resolve({ width: img.width, height: img.height });
                        img.onerror = () => resolve({ width: 0, height: 0 });
                        img.src = url;
                    });

                    let dispWidth = dimensions.width > 0 ? dimensions.width / 2 : 100;
                    let dispHeight = dimensions.height > 0 ? dimensions.height / 2 : 16;

                    const MAX_WIDTH = 600;
                    if (dispWidth > MAX_WIDTH) {
                        const ratio = MAX_WIDTH / dispWidth;
                        dispWidth = MAX_WIDTH;
                        dispHeight = dispHeight * ratio;
                    }

                    textRuns.push(new ImageRun({
                        data: bytes.buffer,
                        transformation: { width: dispWidth, height: dispHeight },
                        type: imgType as any
                    }));
                } else {
                    const isCodeCogs = url.includes('codecogs.com');
                    const fetchUrl = isCodeCogs ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}` : url;
                    
                    const response = await fetch(fetchUrl);
                    if (!response.ok) throw new Error("Fetch failed");
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();

                    const objectUrl = window.URL.createObjectURL(blob);
                    const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
                        const img = new globalThis.Image();
                        img.onload = () => resolve({ width: img.width, height: img.height });
                        img.onerror = () => resolve({ width: 0, height: 0 });
                        img.src = objectUrl;
                    });
                    window.URL.revokeObjectURL(objectUrl);
                    
                    if (arrayBuffer.byteLength > 0 && dimensions.width > 0) {
                        let dispWidth = dimensions.width > 0 ? dimensions.width / 2 : 100;
                        let dispHeight = dimensions.height > 0 ? dimensions.height / 2 : 16;
                        
                        const MAX_WIDTH = 600;
                        if (dispWidth > MAX_WIDTH) {
                            const ratio = MAX_WIDTH / dispWidth;
                            dispWidth = MAX_WIDTH;
                            dispHeight = dispHeight * ratio;
                        }
                        
                        textRuns.push(new ImageRun({
                            data: arrayBuffer,
                            transformation: { width: dispWidth, height: dispHeight },
                            type: 'png'
                        }));
                    }
                }
            } catch(e) {
                console.error("Base64/Image render error:", e);
                textRuns.push(new TextRun({ text: sanitizeText("[Image/Math Render Error]"), size: headingSize, font: 'Calibri', color: 'FF0000', bold: isHeadingBold }));
            }
        } else {
            textRuns.push(new TextRun({ text: sanitizeText(part), size: headingSize, font: 'Calibri', bold: isHeadingBold }));
        }
      } else if (part.startsWith('**') && part.endsWith('**')) {
        textRuns.push(new TextRun({ text: sanitizeText(part.slice(2, -2)), bold: true, size: headingSize, font: 'Calibri' }));
      } else if (part.startsWith('*') && part.endsWith('*')) {
        textRuns.push(new TextRun({ text: sanitizeText(part.slice(1, -1)), italics: true, size: headingSize, font: 'Calibri', bold: isHeadingBold }));
      } else {
        textRuns.push(new TextRun({ text: sanitizeText(part), size: headingSize, font: 'Calibri', bold: isHeadingBold }));
      }
    }

    elements.push(new Paragraph({
      children: textRuns,
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      indent: indent ? { left: indent } : undefined
    }));
  }

  if (inCodeBlock && codeLines.length > 0) {
    const codeParagraphs = codeLines.map((cLine: string, idx: number) => {
      const lineNumStr = String(idx + 1).padStart(3, ' ') + ' | ';
      return new Paragraph({
        children: [
           new TextRun({ text: lineNumStr, font: 'Courier New', size: 20, color: '6B7280' }),
           ...highlightPythonLine(cLine)
        ],
        indent: { left: 450, hanging: 450 },
        spacing: { line: 240 },
      });
    });

    const codeTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: codeParagraphs.length > 0 ? codeParagraphs : [new Paragraph({ text: '' })],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              shading: { fill: 'F9FAFB' }
            }),
          ],
        }),
      ],
    });
    
    elements.push(codeTable);
    elements.push(new Paragraph({ spacing: { after: 200 } }));
  }

  return elements;
}

async function createImagesParagraphs(images: UserImage[], prefix: string, bab: string, startIndex: number): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  let index = startIndex;
  
  for (const img of images) {
    if (!img || !img.dataUrl) continue;
    if (img.dataUrl.startsWith('data:application/pdf')) continue;
    
    try {
      const mimeMatch = img.dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,/i);
      let imgType: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
      if (mimeMatch) {
        const mime = mimeMatch[1].toLowerCase();
        if (mime === 'jpeg' || mime === 'jpg') imgType = 'jpg';
        else if (mime === 'gif') imgType = 'gif';
        else if (mime === 'bmp') imgType = 'bmp';
      }

      const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
        const imgObj = new globalThis.Image();
        imgObj.onload = () => resolve({ width: imgObj.width, height: imgObj.height });
        imgObj.onerror = () => resolve({ width: 400, height: 300 });
        imgObj.src = img.dataUrl;
      });

      let dispWidth = dimensions.width;
      let dispHeight = dimensions.height;
      const MAX_WIDTH = 600;
      if (dispWidth > MAX_WIDTH) {
        const ratio = MAX_WIDTH / dispWidth;
        dispWidth = MAX_WIDTH;
        dispHeight = dispHeight * ratio;
      }

      let arrayBuffer: ArrayBuffer;
      if (img.dataUrl.startsWith('data:image/')) {
          const base64Data = img.dataUrl.split(',')[1];
          let cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
          const padLength = 4 - (cleanBase64.length % 4);
          if (padLength !== 4) {
              cleanBase64 += '='.repeat(padLength);
          }
          const binaryString = atob(cleanBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
          }
          arrayBuffer = bytes.buffer;
      } else {
          const response = await fetch(img.dataUrl);
          arrayBuffer = await response.arrayBuffer();
      }
      
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: arrayBuffer,
              transformation: {
                width: dispWidth,
                height: dispHeight,
              },
              type: imgType,
            }),
          ],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: `Gambar ${bab}.${index} ${prefix}`,
              size: 22,
              font: 'Calibri',
            }),
          ],
          spacing: { before: 100, after: 300 },
        })
      );
      index++;
    } catch (e) {
      console.error('Failed to add user image', e);
    }
  }
  return paragraphs;
}

async function convertHtmlToImageBuffer(htmlContent: string): Promise<{ buffer: ArrayBuffer, width: number, height: number } | null> {
  if (typeof document === 'undefined') return null;
  
  return new Promise((resolve) => {
    const div = document.createElement('div');
    let cleanHtmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    div.innerHTML = cleanHtmlContent;
    div.style.position = 'absolute';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.background = 'white';
    div.style.color = 'black'; 
    div.style.display = 'inline-block';

    const tables = div.getElementsByTagName('table');
    for (let i = 0; i < tables.length; i++) {
       tables[i].style.borderCollapse = 'collapse';
       tables[i].style.fontSize = '12px';
       tables[i].style.fontFamily = 'sans-serif';
       tables[i].style.color = '#000000';
       tables[i].style.margin = '10px';
       const ths = tables[i].getElementsByTagName('th');
       const tds = tables[i].getElementsByTagName('td');
       for (let j = 0; j < ths.length; j++) {
           ths[j].style.border = '1px solid #d1d5db';
           ths[j].style.padding = '6px 12px';
           ths[j].style.backgroundColor = '#f1f5f9';
           ths[j].style.textAlign = 'left';
       }
       for (let j = 0; j < tds.length; j++) {
           tds[j].style.border = '1px solid #e5e7eb';
           tds[j].style.padding = '6px 12px';
           if (!tds[j].style.textAlign) {
               tds[j].style.textAlign = 'left';
           }
       }
    }

    document.body.appendChild(div);

    import('html2canvas-pro').then(({ default: html2canvas }) => {
      html2canvas(div, { 
        backgroundColor: '#ffffff', 
        scale: 2,
        useCORS: true,
        logging: false
      }).then(canvas => {
         document.body.removeChild(div);
         const dataUrl = canvas.toDataURL('image/png');
         const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
         const binaryString = window.atob(base64Data);
         const bytes = new Uint8Array(binaryString.length);
         for (let i = 0; i < binaryString.length; i++) {
             bytes[i] = binaryString.charCodeAt(i);
         }
         resolve({ buffer: bytes.buffer, width: canvas.width / 2, height: canvas.height / 2 });
      }).catch(err => {
         console.error("html2canvas error", err);
         if (document.body.contains(div)) document.body.removeChild(div);
         resolve(null);
      });
    });
  });
}

async function renderNotebookCells(
  cells: { cell: any, index: number, notebookIndex: number }[],
  aiData: AIReportData,
  chapterPrefix: string,
  startCodeIndex: number,
  startImageIndex: number
) {
  const children: any[] = [];
  let codeIdx = startCodeIndex;
  let imgIdx = startImageIndex;

  const cellAnalysesArray = aiData.cellAnalyses || (aiData as any).praktikum?.cellAnalyses || (aiData as any).kuliah?.cellAnalyses;

  for (const { cell, index, notebookIndex } of cells) {
    if (cell.cell_type === 'markdown' && cell.source.trim()) {
      const parsedMd = await parseMarkdownToParagraphs(cell.source);
      const titleRow = new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Penjelasan Teks (Markdown)", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
            shading: { fill: 'F3F4F6' },
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
          })
        ]
      });
      const mdRow = new TableRow({
        children: [
          new TableCell({
            children: parsedMd.length > 0 ? parsedMd : [new Paragraph({ text: '' })],
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          })
        ]
      });
      const mdTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        },
        rows: [titleRow, mdRow],
      });
      children.push(mdTable);
      children.push(new Paragraph({ spacing: { after: 200 } }));
    } else if (cell.cell_type === 'code' && cell.source.trim()) {
      const codeLines = cell.source.split('\n');
      const codeParagraphs = codeLines.map((line: string, idx: number) => {
        const lineNumStr = String(idx + 1).padStart(3, ' ') + ' | ';
        return new Paragraph({
          children: [
             new TextRun({ text: lineNumStr, font: 'Courier New', size: 20, color: '6B7280' }),
             ...highlightPythonLine(line)
          ],
          indent: { left: 450, hanging: 450 },
          spacing: { line: 240 },
        });
      });

      const titleRow = new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Kode Program", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
            shading: { fill: 'F3F4F6' },
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
          })
        ]
      });

      const tableRows: TableRow[] = [
        titleRow,
        new TableRow({
          children: [
            new TableCell({
              children: codeParagraphs.length > 0 ? codeParagraphs : [new Paragraph({ text: '' })],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
          ],
        }),
      ];

      const analysis = cellAnalysesArray?.find((a: any) => 
        a.cellIndex === index && (a.notebookIndex === undefined || a.notebookIndex === notebookIndex)
      );
      const caption = analysis?.caption || 'Blok Kode';
      const tableCaption = analysis?.tableCaption || analysis?.caption || 'Output Visual';

      let hasTextOutput = false;
      const htmlImages: any[] = [];
      
      if (cell.outputs) {
        for (const output of cell.outputs) {
           if (output.type === 'html' && output.content.trim()) {
             const imgData = await convertHtmlToImageBuffer(output.content);
             if (imgData) {
               let dispWidth = imgData.width;
               let dispHeight = imgData.height;
               const MAX_WIDTH = 600;
               if (dispWidth > MAX_WIDTH) {
                   const ratio = MAX_WIDTH / dispWidth;
                   dispWidth = MAX_WIDTH;
                   dispHeight = dispHeight * ratio;
               }
               htmlImages.push(
                 new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                       new ImageRun({
                          data: imgData.buffer,
                          transformation: { width: dispWidth, height: dispHeight },
                          type: 'png'
                       })
                    ]
                 }),
                 new Paragraph({
                   heading: HeadingLevel.HEADING_4,
                   alignment: AlignmentType.CENTER,
                   children: [
                     new TextRun({
                       text: `Gambar ${chapterPrefix}.${imgIdx} ${tableCaption}`,
                       size: 22,
                       font: 'Calibri',
                     }),
                   ],
                   spacing: { before: 100, after: 300 },
                 })
               );
               imgIdx++;
             } else {
               const outputLines = output.content.split('\n');
               const outputParagraphs = outputLines.map((line: string) => {
                 return new Paragraph({
                   children: [
                     new TextRun({ text: sanitizeText(line), font: 'Courier New', size: 20 }),
                   ],
                   spacing: { line: 240 },
                 });
               });
               tableRows.push(
                 new TableRow({
                   children: [
                     new TableCell({
                       children: [new Paragraph({ children: [new TextRun({ text: "Hasil Output", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
                       shading: { fill: 'F3F4F6' },
                       margins: { top: 50, bottom: 50, left: 100, right: 100 },
                     })
                   ]
                 }),
                 new TableRow({
                   children: [
                     new TableCell({
                       children: outputParagraphs,
                       margins: { top: 100, bottom: 100, left: 100, right: 100 },
                     }),
                   ],
                 })
               );
             }
           } else if (output.type === 'text' && output.content.trim()) {
             const outputLines = output.content.split('\n');
             const outputParagraphs = outputLines.map((line: string) => {
               return new Paragraph({
                 children: [
                   new TextRun({ text: sanitizeText(line), font: 'Courier New', size: 20 }),
                 ],
                 spacing: { line: 240 },
               });
             });
             
             tableRows.push(
               new TableRow({
                 children: [
                   new TableCell({
                     children: [new Paragraph({ children: [new TextRun({ text: "Hasil Output", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
                     shading: { fill: 'F3F4F6' },
                     margins: { top: 50, bottom: 50, left: 100, right: 100 },
                   })
                 ]
               }),
               new TableRow({
                 children: [
                   new TableCell({
                     children: outputParagraphs,
                     margins: { top: 100, bottom: 100, left: 100, right: 100 },
                   }),
                 ],
               })
             );
             hasTextOutput = true;
           }
        }
      }

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
              font: 'Calibri',
            }),
          ],
          spacing: { before: 100, after: 300 },
        })
      );
      
      // Append HTML rendered Images after the CODE CAPTION
      if (htmlImages.length > 0) {
        children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));
        for (const pt of htmlImages) {
          children.push(pt);
          children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));
        }
      }

      // Paragraf Penjelasan AI
      if (analysis && analysis.explanation) {
         const parsedExp = await parseMarkdownToParagraphs(analysis.explanation);
         children.push(...parsedExp);
         children.push(new Paragraph({ spacing: { after: 200 } }));
      }

      codeIdx++;

      // Process and Push Native Image Outputs Notebook
      if (cell.outputs) {
        for (const output of cell.outputs) {
          if (output.type === 'image') {
            try {
               let cleanBase64 = output.content.replace(/[^A-Za-z0-9+/=]/g, '');
               const padLength = 4 - (cleanBase64.length % 4);
               if (padLength !== 4) {
                   cleanBase64 += '='.repeat(padLength);
               }

               const binaryString = atob(cleanBase64);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let i = 0; i < len; i++) {
                 bytes[i] = binaryString.charCodeAt(i);
               }
               
               const dataUrl = `data:image/png;base64,${cleanBase64}`;
               const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
                 const imgObj = new globalThis.Image();
                 imgObj.onload = () => resolve({ width: imgObj.width, height: imgObj.height });
                 imgObj.onerror = () => resolve({ width: 400, height: 300 });
                 imgObj.src = dataUrl;
               });

               let dispWidth = dimensions.width;
               let dispHeight = dimensions.height;
               const MAX_WIDTH = 600;
               if (dispWidth > MAX_WIDTH) {
                 const ratio = MAX_WIDTH / dispWidth;
                 dispWidth = MAX_WIDTH;
                 dispHeight = dispHeight * ratio;
               }
               
               children.push(
                 new Paragraph({
                   alignment: AlignmentType.CENTER,
                   children: [
                     new ImageRun({
                       data: bytes.buffer,
                       transformation: {
                         width: dispWidth,
                         height: dispHeight,
                       },
                       type: 'png',
                     }),
                   ],
                 })
               );

               children.push(
                new Paragraph({
                  heading: HeadingLevel.HEADING_4,
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Gambar ${chapterPrefix}.${imgIdx} ${tableCaption}`,
                      size: 22,
                      font: 'Calibri',
                    }),
                  ],
                  spacing: { before: 100, after: 300 },
                })
              );
              imgIdx++;
            } catch (e) {
              console.error('Failed to add image output', e);
            }
          }
        }
      }
    }
  }
  return { paragraphs: children, nextCodeIdx: codeIdx, nextImgIdx: imgIdx };
}

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
  numImplNotebooks: number = notebooks.length
): Promise<Blob> {
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
        new TextRun({ text: sanitizeText(metadata.judulPertemuan), bold: true, size: 28, font: 'Calibri' }),
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
  }

  const usedImplImages = new Set<number>();
  if (cellAnalysesArray) {
    for (const analysis of cellAnalysesArray) {
      if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
        const img = implImages[analysis.imageIndex];
        if (img) {
          usedImplImages.add(analysis.imageIndex);
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
    }
  }
  
  const unusedImplImages = implImages.filter((_, idx) => !usedImplImages.has(idx));
  if (unusedImplImages.length > 0) {
    const implImgParagraphs = await createImagesParagraphs(unusedImplImages, 'Implementasi', 'II', implImageIndex);
    bodyChildren.push(...implImgParagraphs);
  }

  if (!isKuliah) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'D. Analisis Hasil', bold: true, size: 22, font: 'Calibri', color: '000000' })],
        spacing: { before: 200, after: 100 },
      })
    );
    bodyChildren.push(...(await parseMarkdownToParagraphs(cAnalysis)));
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
    bodyChildren.push(...(await parseMarkdownToParagraphs(cAnalysis)));
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

    const unusedPostTestImages = postTestImages.filter((_, idx) => !usedPostTestImages.has(idx));
    if (unusedPostTestImages.length > 0) {
      bodyChildren.push(
        new Paragraph({
          children: [new TextRun({ text: "Berikut adalah lampiran gambar lembar jawaban Post-Test yang dikerjakan:", size: 22, font: 'Calibri' })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 200, after: 100 },
        })
      );
      const postTestImgParagraphs = await createImagesParagraphs(unusedPostTestImages, 'Lembar Jawaban Post-Test', 'III', postTestImageIndex);
      bodyChildren.push(...postTestImgParagraphs);
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