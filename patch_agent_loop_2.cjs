const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

content = content.replace(
  /c\.type === 'code'/g,
  "c.cell_type === 'code'"
);

fs.writeFileSync('src/lib/ai/agent-loop.ts', content);
