const fs = require('fs');
let lines = fs.readFileSync('src/lib/docx/markdown.ts', 'utf8').split('\n');
lines.splice(105, 12, 
  '    if (isFirstLine && options?.prefix) {',
  '      textRuns.push(',
  '        new TextRun({',
  "          text: sanitizeText(options.prefix + ' '),",
  '          bold: options.prefixBold ?? false,',
  '          size: headingSize,',
  '          font: FONT_CALIBRI,',
  '        })',
  '      );',
  '      isFirstLine = false;',
  '    }'
);
fs.writeFileSync('src/lib/docx/markdown.ts', lines.join('\n'));
