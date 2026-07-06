const fs = require('fs');
let lines = fs.readFileSync('src/lib/docx/markdown.ts', 'utf8').split('\n');
lines[132] = '        })';
lines.splice(133, 0, '      );');
fs.writeFileSync('src/lib/docx/markdown.ts', lines.join('\n'));
