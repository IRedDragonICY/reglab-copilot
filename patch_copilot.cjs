const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

code = code.replace(
  '        c.parsedNotebooks.length,\n      );',
  '        c.parsedNotebooks.length,\n        (msg) => setStatusText(msg)\n      );'
);

code = code.replace(
  '        parsedNotebooks.length,\n        setGeneratedDocxBlob,\n      );',
  '        parsedNotebooks.length,\n        (msg) => setStatusText(msg)\n      );\n      setGeneratedDocxBlob(docxBlob);'
);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', code);
