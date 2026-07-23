const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

content = content.replace(
  /if \(totalCells > 0 && analyzedCells < totalCells && loopIndex < resolvedMaxLoops - 1\) \{/g,
  "if (totalCells > 0 && analyzedCells < totalCells && loopIndex < resolvedMaxLoops) {"
);

fs.writeFileSync('src/lib/ai/agent-loop.ts', content);
