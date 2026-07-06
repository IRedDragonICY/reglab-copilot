const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');
code = code.replace(
  '  numImplNotebooks: number = notebooks.length\n): Promise<Blob> {',
  '  numImplNotebooks: number = notebooks.length,\n  onProgress?: (msg: string) => void\n): Promise<Blob> {'
);
fs.writeFileSync('src/lib/docx/builder.ts', code);
