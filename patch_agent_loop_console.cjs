const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

content = content.replace(
  /if \(totalCells > 0 && analyzedCells < totalCells && loopIndex < resolvedMaxLoops - 1\) \{/g,
  "console.log('totalCells:', totalCells, 'analyzedCells:', analyzedCells, 'loopIndex:', loopIndex, 'resolvedMaxLoops:', resolvedMaxLoops);\nif (totalCells > 0 && analyzedCells < totalCells && loopIndex < resolvedMaxLoops - 1) {"
);

fs.writeFileSync('src/lib/ai/agent-loop.ts', content);
