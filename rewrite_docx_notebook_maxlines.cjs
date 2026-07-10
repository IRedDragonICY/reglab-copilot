const fs = require('fs');
let text = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

text = text.replace(
  /const MAX_LINES = 100;/g,
  "const MAX_LINES = 500;"
);
text = text.replace(
  /if \(lines\.length > 100\) \{/g,
  "if (lines.length > 500) {"
);

fs.writeFileSync('src/lib/docx/notebook.ts', text);

let text2 = fs.readFileSync('src/components/report-preview.tsx', 'utf8');
text2 = text2.replace(
  /const MAX_LINES = 100;/g,
  "const MAX_LINES = 500;"
);
fs.writeFileSync('src/components/report-preview.tsx', text2);
console.log("Done");
