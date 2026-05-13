import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ImageRun
} from 'docx';
import { preprocessMathToImages } from '../parser';
import { highlightPythonLine } from '../syntaxHighlighter';
import { sanitizeText, convertHtmlToImageBuffer } from './utils';
import { UserImage, AIReportData } from './types';

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
        // End of code block
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
        elements.push(new Paragraph({ spacing: { after: 200 } })); // space after table
        
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
    
    // Headings
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

export async function createImagesParagraphs(images: UserImage[], prefix: string, bab: string, startIndex: number): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  let index = startIndex;
  
  for (const img of images) {
    if (!img || !img.dataUrl) continue;
    if (img.dataUrl.startsWith('data:application/pdf')) {
       // Skip PDF for now in DOCX as ImageRun doesn't support it directly
       // The AI already extracted the text from it anyway.
       continue;
    }
    try {
      // Extract mime type to set correct image type for docx
      const mimeMatch = img.dataUrl.match(/^data:image\/(png|jpeg|jpg|gif|bmp);base64,/i);
      let imgType: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
      if (mimeMatch) {
        const mime = mimeMatch[1].toLowerCase();
        if (mime === 'jpeg' || mime === 'jpg') imgType = 'jpg';
        else if (mime === 'gif') imgType = 'gif';
        else if (mime === 'bmp') imgType = 'bmp';
      }

      // Get dimensions to preserve aspect ratio
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

      // Use fetch to safely convert data URL to ArrayBuffer
      const response = await fetch(img.dataUrl);
      const arrayBuffer = await response.arrayBuffer();
      
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

export async function renderNotebookCells(
  cells: { cell: any, index: number, notebookIndex: number }[],
  aiData: AIReportData,
  chapterPrefix: string,
  startCodeIndex: number,
  startImageIndex: number
) {
  const children: any[] = [];
  let codeIdx = startCodeIndex;
  let imgIdx = startImageIndex;

  const cellAnalysesArray = aiData.cellAnalyses || (aiData as any).praktikum?.cellAnalyses;

  for (const { cell, index, notebookIndex } of cells) {
    if (cell.cell_type === 'markdown' && cell.source.trim()) {
      const parsedMd = await parseMarkdownToParagraphs(cell.source);
      const titleRow = new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: "Cell Text (Markdown)", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
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
      // Add Code Block
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
            children: [new Paragraph({ children: [new TextRun({ text: "Cell Kode", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
            shading: { fill: 'F3F4F6' },
            margins: { top: 50, bottom: 50, left: 100, right: 100 },
          })
        ]
      });

      // Combine code and outputs into a single table with multiple rows
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
      const caption = analysis?.caption || 'Implementasi Kode';
      const tableCaption = analysis?.tableCaption || 'Tabel/Output DataFrame';

      // Process Text Outputs (as 2nd row in table)
      let hasTextOutput = false;
      const htmlImages: any[] = [];
      
      if (cell.outputs) {
        for (const output of cell.outputs) {
           if (output.type === 'html' && output.content.trim()) {
             const imgData = await convertHtmlToImageBuffer(output.content);
             if (imgData) {
               // Calculate display dimensions to fit A4 width
               let dispWidth = imgData.width;
               let dispHeight = imgData.height;
               const MAX_WIDTH = 600; // max safe width for A4
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
               // Fallback if parsing fails
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
                       children: [new Paragraph({ children: [new TextRun({ text: "Cell Output", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
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
                     children: [new Paragraph({ children: [new TextRun({ text: "Cell Output", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
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

      // Add Explanation
      if (analysis && analysis.explanation) {
         const parsedExp = await parseMarkdownToParagraphs(analysis.explanation);
         tableRows.push(
             new TableRow({
               children: [
                 new TableCell({
                   children: [new Paragraph({ children: [new TextRun({ text: "Cell Penjelasan (AI Analysis)", bold: true, font: "Calibri", size: 20 })], spacing: { before: 50, after: 50 } })],
                   shading: { fill: 'EFF6FF' },
                   margins: { top: 50, bottom: 50, left: 100, right: 100 },
                 })
               ]
             }),
             new TableRow({
               children: [
                 new TableCell({
                   children: parsedExp.length > 0 ? parsedExp : [new Paragraph({ text: '' })],
                   margins: { top: 100, bottom: 100, left: 100, right: 100 },
                 }),
               ],
             })
         );
      }

      codeIdx++;

      // Process Image Outputs (add after the table)
      if (cell.outputs) {
        for (const output of cell.outputs) {
          if (output.type === 'image') {
            try {
               const cleanBase64 = output.content.replace(/\s+/g, '');
               const dataUrl = `data:image/png;base64,${cleanBase64}`;
               const binaryString = atob(cleanBase64);
               const len = binaryString.length;
               const bytes = new Uint8Array(len);
               for (let i = 0; i < len; i++) {
                 bytes[i] = binaryString.charCodeAt(i);
               }
               
               // Get dimensions to preserve aspect ratio
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
                      text: `Gambar ${chapterPrefix}.${imgIdx} ${caption}`,
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