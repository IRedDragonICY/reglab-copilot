const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

code = code.replace(
  '  numImplNotebooks: number = notebooks.length\n): Promise<Blob> {\n  if (onProgress) onProgress("Membangun cover halaman...");',
  '  numImplNotebooks: number = notebooks.length,\n  onProgress?: (msg: string) => void\n): Promise<Blob> {\n  if (onProgress) onProgress("Membangun cover halaman...");'
);

fs.writeFileSync('src/lib/docx/builder.ts', code);
