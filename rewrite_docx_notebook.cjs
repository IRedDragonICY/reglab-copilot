const fs = require('fs');
let text = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

text = text.replace(
  /sanitizeText\(line\.substring\(0, 1000\)\)/g,
  "sanitizeText(line.substring(0, 15000))"
);

fs.writeFileSync('src/lib/docx/notebook.ts', text);
