const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

const regex = /if \(cellAnalysesArray\) \{\s*for \(const analysis of cellAnalysesArray\) \{\s*if \(analysis\.section === 'implementasi' && analysis\.imageIndex !== undefined\) \{\s*const img = implImages\[analysis\.imageIndex\];\s*if \(img\) \{\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*children: \[new TextRun\(\{ text: String\(analysis\.caption\)\.replace\(\/\['"\]\/g, ''\), bold: true, size: 22, font: 'Calibri' \}\)\],\s*spacing: \{ before: 200, after: 100 \},\s*\}\)\s*\);\s*const imgParagraphs = await createImagesParagraphs\(\[img\], String\(analysis\.caption\)\.replace\(\/\['"\]\/g, ''\), isResume \? '' : 'II', implImageIndex\);\s*bodyChildren\.push\(\.\.\.imgParagraphs\);\s*implImageIndex\+\+;\s*bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(analysis\.explanation\)\)\);\s*\}\s*\}\s*await yieldThread\(\);\s*\}\s*\}/;

const replacement = `if (cellAnalysesArray) {
    for (const analysis of cellAnalysesArray) {
      if (analysis.section === 'implementasi') {
        let renderedImage = false;
        if (analysis.imageIndex !== undefined) {
          const img = implImages[analysis.imageIndex];
          if (img) {
            bodyChildren.push(
              new Paragraph({
                children: [new TextRun({ text: String(analysis.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
                spacing: { before: 200, after: 100 },
              })
            );
            
            const imgParagraphs = await createImagesParagraphs([img], String(analysis.caption).replace(/['"]/g, ''), isResume ? '' : 'II', implImageIndex);
            bodyChildren.push(...imgParagraphs);
            implImageIndex++;
            bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
            renderedImage = true;
          }
        }
        
        if (!renderedImage && (notebooks.length === 0 || analysis.notebookIndex === -1)) {
          if (analysis.caption) {
            bodyChildren.push(
              new Paragraph({
                children: [new TextRun({ text: String(analysis.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
                spacing: { before: 200, after: 100 },
              })
            );
          }
          if (analysis.explanation) {
            bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
          }
        }
      }
      await yieldThread();
    }
  }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/lib/docx/builder.ts', content);
