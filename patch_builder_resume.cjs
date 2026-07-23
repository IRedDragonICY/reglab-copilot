const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// The logic for BAB I PENDAHULUAN
code = code.replace(
  /children: \[\s*new TextRun\(\{ text: 'BAB I', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'PENDAHULUAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],/g,
  `children: isResume ? [
          new TextRun({ text: 'PENDAHULUAN', bold: true, size: 22, font: 'Calibri', color: '000000' })
        ] : [
          new TextRun({ text: 'BAB I', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'PENDAHULUAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],`
);

// BAB II PEMBAHASAN
code = code.replace(
  /children: \[\s*new TextRun\(\{ text: 'BAB II', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'PEMBAHASAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],/g,
  `children: isResume ? [] : [
          new TextRun({ text: 'BAB II', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'PEMBAHASAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],`
);

// BAB III KESIMPULAN
code = code.replace(
  /children: \[\s*new TextRun\(\{ text: 'BAB III', bold: true, size: 22, font: 'Calibri', color: '000000' \}\),\s*new TextRun\(\{ text: 'KESIMPULAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 \}\)\s*\],/g,
  `children: isResume ? [
          new TextRun({ text: 'KESIMPULAN', bold: true, size: 22, font: 'Calibri', color: '000000' })
        ] : [
          new TextRun({ text: 'BAB III', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'KESIMPULAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],`
);

fs.writeFileSync('src/lib/docx/builder.ts', code);
