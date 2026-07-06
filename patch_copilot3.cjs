const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

code = code.replace(
  /      numImplNotebooks,\s*\);\s*setGeneratedDocxBlob\(docxBlob\);/g,
  `      numImplNotebooks,
      (msg) => setStatusText(msg)
    );
    setGeneratedDocxBlob(docxBlob);`
);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', code);
