const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

code = code.replace(
  '  for (let nbIdx = 0; nbIdx < notebooks.length; nbIdx++) {',
  '  for (let nbIdx = 0; nbIdx < notebooks.length; nbIdx++) {\n    if (onProgress) onProgress(`Memproses implementasi dari file ke-${nbIdx + 1}...`);'
);

fs.writeFileSync('src/lib/docx/builder.ts', code);
