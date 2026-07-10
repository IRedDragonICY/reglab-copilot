const fs = require('fs');

function replaceMaxLines(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/const MAX_LINES = 20;/g, 'const MAX_LINES = 100;');
  content = content.replace(/\.\.\.lines\.slice\(0, 15\),/g, '...lines.slice(0, 80),');
  content = content.replace(/\.\.\.lines\.slice\(-5\)/g, '...lines.slice(-15)');
  fs.writeFileSync(filePath, content);
}

replaceMaxLines('src/lib/docx/notebook.ts');
replaceMaxLines('src/components/report-preview.tsx');

console.log("Patched lines");
