const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

code = code.replace(
  /\{\s*metadata\.reportType === 'resume' \? \(/g,
  `metadata.reportType === 'resume' ? (`
);

fs.writeFileSync('src/components/report-preview.tsx', code);
