const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

code = code.replace(
  '      numImplNotebooks,\n    );\n    setGeneratedDocxBlob(docxBlob);',
  '      numImplNotebooks,\n      (msg) => setStatusText(msg)\n    );\n    setGeneratedDocxBlob(docxBlob);'
);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', code);
