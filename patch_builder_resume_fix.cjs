const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// For BAB II, instead of pushing an empty children array, let's wrap the whole thing in an if (!isResume)
code = code.replace(
  /bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*alignment: AlignmentType\.CENTER,\s*children: isResume \? \[\] : \[\s*new TextRun\(\{ text: 'BAB II', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'PEMBAHASAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],\s*spacing: \{ before: 400, after: 200 \},\s*\}\)\s*\);/g,
  `if (!isResume) {
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

fs.writeFileSync('src/lib/docx/builder.ts', code);
