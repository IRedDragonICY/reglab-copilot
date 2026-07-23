const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

content = content.replace(
  /console\.log\('totalCells:', totalCells, 'analyzedCells:', analyzedCells, 'loopIndex:', loopIndex, 'resolvedMaxLoops:', resolvedMaxLoops\);\n/g,
  ""
);

fs.writeFileSync('src/lib/ai/agent-loop.ts', content);
