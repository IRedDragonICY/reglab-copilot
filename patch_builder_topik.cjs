const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

content = content.replace(
  /new TextRun\(\{ text: isKuliah \? 'Topik' : 'Materi', bold: true, size: 28, font: 'Calibri' \}\)/,
  "new TextRun({ text: isResume ? 'Topik/Acara' : isKuliah ? 'Topik' : 'Materi', bold: true, size: 28, font: 'Calibri' })"
);

fs.writeFileSync('src/lib/docx/builder.ts', content);
