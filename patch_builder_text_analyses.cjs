const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

const targetImpl = `  if (cellAnalysesArray) {
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
          
          const imgParagraphs = await createImagesParagraphs([img], String(analysis.caption).replace(/['"]/g, ''), isResume ? '' : 'II', implImageIndex);
          bodyChildren.push(...imgParagraphs);
          implImageIndex++;
          bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
        }
      }
      await yieldThread();
    }
  }`;

const replacementImpl = `  if (cellAnalysesArray) {
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

content = content.replace(targetImpl, replacementImpl);

fs.writeFileSync('src/lib/docx/builder.ts', content);
