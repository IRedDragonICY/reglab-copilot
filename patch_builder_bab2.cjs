const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// The block is:
// if (!isKuliah && !isResume) {
//   ... bodyChildren.push(...(await parseMarkdownToParagraphs(narrative)));
// } else {
//   ... BAB II ...

content = content.replace(/bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(narrative\)\)\);\n  \} else \{/, "bodyChildren.push(...(await parseMarkdownToParagraphs(narrative)));\n  } else if (isKuliah) {");

fs.writeFileSync('src/lib/docx/builder.ts', content);
