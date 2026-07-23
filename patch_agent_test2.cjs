const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

content = content.replace(
  /\{ type: 'code', source: 'print\(1\)', outputs: \[\] \},/g,
  "{ cell_type: 'code', source: 'print(1)', outputs: [] },"
);
content = content.replace(
  /\{ type: 'code', source: 'print\(2\)', outputs: \[\] \},/g,
  "{ cell_type: 'code', source: 'print(2)', outputs: [] },"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
