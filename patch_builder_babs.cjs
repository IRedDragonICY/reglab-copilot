const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// Bab I
content = content.replace(
  /\} else if \(isKuliah\) \{\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*alignment: AlignmentType\.CENTER,\s*children: \[\s*new TextRun\(\{ text: 'BAB I', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'PENDAHULUAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],\s*spacing: \{ before: 400, after: 200 \},\s*\}\)\s*\);\s*if \(pendahuluanText\) \{\s*bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(pendahuluanText\)\)\);\s*\} else if \(modulContext\) \{\s*bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(modulContext\)\)\);\s*\}\s*\} else if \(isResume\) \{\s*if \(pendahuluanText\) \{\s*bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(pendahuluanText\)\)\);\s*\} else if \(modulContext\) \{\s*bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(modulContext\)\)\);\s*\}\s*\}/s,
  `} else {
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
  }`
);

// Bab II
content = content.replace(
  /\} else if \(isKuliah\) \{\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*alignment: AlignmentType\.CENTER,\s*children: \[\s*new TextRun\(\{ text: 'BAB II', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'PEMBAHASAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],\s*spacing: \{ before: 400, after: 200 \},\s*\}\)\s*\);\s*\}/s,
  `} else {
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
  }`
);

// Bab III
content = content.replace(
  /\} else if \(isKuliah\) \{\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*alignment: AlignmentType\.CENTER,\s*children: \[\s*new TextRun\(\{ text: 'BAB III', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'KESIMPULAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],\s*spacing: \{ before: 400, after: 200 \},\s*\}\)\s*\);\s*let kesimpulanImageIndex = 1;\s*const \{ elements \} = await renderCAnalysis\(cAnalysis, isResume \? '' : 'III', kesimpulanImageIndex\);\s*bodyChildren\.push\(\.\.\.elements\);\s*\} else if \(isResume\) \{\s*let kesimpulanImageIndex = 1;\s*const \{ elements \} = await renderCAnalysis\(cAnalysis, isResume \? '' : 'II', kesimpulanImageIndex\);\s*bodyChildren\.push\(\.\.\.elements\);\s*\}/s,
  `} else {
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
    const { elements } = await renderCAnalysis(cAnalysis, isResume ? '' : 'III', kesimpulanImageIndex);
    bodyChildren.push(...elements);
  }`
);

fs.writeFileSync('src/lib/docx/builder.ts', content);
