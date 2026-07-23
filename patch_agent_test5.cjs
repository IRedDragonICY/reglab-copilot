const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

content = content.replace(
  /const totalCells = args\.ctx\?\.notebooks\.reduce/g,
  "const totalCells = args.ctx?.notebooks.reduce"
);

fs.writeFileSync('src/lib/ai/agent-loop.ts', content);
