const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

code = code.replace(/PENDAHULUAN<\/h1>\s*\)\}/g, 'PENDAHULUAN</h1>\n            )');
code = code.replace(/KESIMPULAN<\/h1>\s*\)\}/g, 'KESIMPULAN</h1>\n            )');
fs.writeFileSync('src/components/report-preview.tsx', code);
