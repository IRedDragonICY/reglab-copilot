const fs = require('fs');
let content = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

content = content.replace(
  /const isKuliah = sessionArg && sessionArg\.metadata\?\.reportType === 'kuliah';/,
  "const isKuliah = sessionArg && sessionArg.metadata?.reportType === 'kuliah';\n      const isResume = sessionArg && sessionArg.metadata?.reportType === 'resume';"
);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', content);
