const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

code = code.replace(
  /    if \(cell\.outputs\) \{\n      const htmlOutputs = cell\.outputs\.filter[\s\S]*?if \(output\.type !== 'image'\) continue;/g,
  "    if (cell.outputs) {\n      for (const output of cell.outputs) {\n        if (output.type !== 'image') continue;"
);

fs.writeFileSync('src/lib/docx/notebook.ts', code);
