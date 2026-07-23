const fs = require('fs');
let content = fs.readFileSync('src/lib/types.ts', 'utf8');

content = content.replace(
  /export type ReportType = 'praktikum' \| 'kuliah';/,
  "export type ReportType = 'praktikum' | 'kuliah' | 'resume';"
);

fs.writeFileSync('src/lib/types.ts', content);
