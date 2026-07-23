const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

content = content.replace(
  /const resolvedDeclarationKey: 'praktikum' \| 'kuliah' = cursor/,
  "const resolvedDeclarationKey: 'praktikum' | 'kuliah' | 'resume' = cursor"
);

fs.writeFileSync('src/lib/ai/agent-loop.ts', content);
