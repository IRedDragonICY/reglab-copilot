const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/markdown.ts', 'utf8');
const lines = code.split('\n');
const fixedLines = [
  '    }',
  '    elements.push(',
  '      new Paragraph({',
  '        children: textRuns,',
  '        alignment: AlignmentType.JUSTIFIED,',
  '        spacing: { after: 120 },',
  '        indent: indent ? { left: indent } : undefined,',
  '      }),',
  '    );',
  '    await yieldThread();',
  '  }',
  '',
  '  // Flush a still-open code block at EOF.',
  '  if (inCodeBlock && codeBuffer.length > 0) {',
  "    elements.push(buildCodeTable(codeBuffer.join('\\n')));",
  '    elements.push(new Paragraph({ spacing: { after: 200 } }));',
  '  }',
  '',
  '  return elements;',
  '}',
];
lines.splice(134, 155 - 134, ...fixedLines);
fs.writeFileSync('src/lib/docx/markdown.ts', lines.join('\n'));
