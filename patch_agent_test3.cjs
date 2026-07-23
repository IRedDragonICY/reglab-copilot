const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

content = content.replace(
  /maxLoops: 5,/g,
  "maxLoops: 2,"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
