const fs = require('fs');
let content = fs.readFileSync('src/lib/copilot/types.ts', 'utf8');

content = content.replace(
  /declarationKey: 'praktikum' \| 'kuliah';/,
  "declarationKey: 'praktikum' | 'kuliah' | 'resume';"
);

fs.writeFileSync('src/lib/copilot/types.ts', content);
