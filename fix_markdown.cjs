const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/markdown.ts', 'utf8');

code = code.replace(
  /let codeBuffer: string\[\] = \[\];\s*for \(const line of lines\) \{/,
  `let codeBuffer: string[] = [];

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      elements.push(buildMarkdownTable(tableRows));
      elements.push(new Paragraph({ spacing: { after: 200 } }));
      tableRows = [];
    }
    inTable = false;
  };

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      if (!inTable) inTable = true;
      const parts = line.trim().split('|').slice(1, -1).map(s => s.trim());
      const isSeparator = parts.length > 0 && parts.every(p => /^:?-+:?$/.test(p.replace(/\\s/g, '')));
      if (!isSeparator && parts.length > 0) {
        tableRows.push(parts);
      }
      continue;
    } else {
      flushTable();
    }`
);

fs.writeFileSync('src/lib/docx/markdown.ts', code);
