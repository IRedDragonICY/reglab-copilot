const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

const regex = /numImplNotebooks:\s*number\s*=\s*notebooks\.length\s*\):\s*Promise<Blob>\s*\{/;
code = code.replace(regex, `numImplNotebooks: number = notebooks.length,
  onProgress?: (msg: string) => void
): Promise<Blob> {`);

fs.writeFileSync('src/lib/docx/builder.ts', code);
