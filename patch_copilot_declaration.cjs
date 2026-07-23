const fs = require('fs');
let content = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

content = content.replace(
  /const activeDeclaration = isKuliah\n        \? generateKuliahReportDeclaration\n        : generateReportDeclaration;/,
  "const activeDeclaration = isKuliah || isResume\n        ? generateKuliahReportDeclaration\n        : generateReportDeclaration;"
);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', content);
