const fs = require('fs');
let lines = fs.readFileSync('src/lib/docx/markdown.ts', 'utf8').split('\n');
lines[112] = '        })';
lines[113] = '      );';
lines.splice(114, 0, '      isFirstLine = false;');
fs.writeFileSync('src/lib/docx/markdown.ts', lines.join('\n'));
