const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

// Line 170: remove duplicate callbacks
content = content.replace(
  /maxLoops: 5,\n      callbacks: \{\},\n      sysMsgBuilder: \(loop\) => `Continue batch \$\{loop\}`,\n      mode: 'append',\n      initial: EMPTY_AI_DATA,\n      callbacks,/,
  "maxLoops: 5,\n      sysMsgBuilder: (loop) => `Continue batch ${loop}`,\n      mode: 'append',\n      initial: EMPTY_AI_DATA,\n      callbacks,"
);

// Line 333: change initialAiData to initial
content = content.replace(
  /initialAiData: \{ cellAnalyses: \[\{ cellIndex: 0, notebookIndex: 0, section: 'implementasi', caption: '1', explanation: '1' \}\] \},/,
  "initial: { cellAnalyses: [{ cellIndex: 0, notebookIndex: 0, section: 'implementasi', caption: '1', explanation: '1' }] },"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
