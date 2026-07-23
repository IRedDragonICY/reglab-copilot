const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

content = content.replace(/if \(isKuliah\) return true;/, 'if (isKuliah || isResume) return true;');

fs.writeFileSync('src/lib/docx/builder.ts', content);
