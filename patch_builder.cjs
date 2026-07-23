const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');
const search = `        children: [
          new TextRun({ text: 'BAB I', bold: true, size: 22, font: 'Calibri', color: '000000' }),
          new TextRun({ text: 'PENDAHULUAN', bold: true, size: 22, font: 'Calibri', color: '000000', break: 1 })
        ],`;
console.log(code.includes(search));
