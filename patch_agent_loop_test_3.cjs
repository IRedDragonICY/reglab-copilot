const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

content = content.replace(
  /      maxLoops: 5,\n      callbacks: \{\},\n      sysMsgBuilder: \(loop\) => `Continue batch \$\{loop\}`,\n      mode: 'append',\n      initial: EMPTY_AI_DATA,\n      callbacks,/g,
  "      maxLoops: 5,\n      sysMsgBuilder: (loop) => `Continue batch ${loop}`,\n      mode: 'append',\n      initial: EMPTY_AI_DATA,\n      callbacks,"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
