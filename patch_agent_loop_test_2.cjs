const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

content = content.replace(
  /initial: \{ cellAnalyses: \[\{ cellIndex: 0, notebookIndex: 0, section: 'implementasi', caption: '1', explanation: '1' \}\] \},/,
  "initial: { cellAnalyses: [{ cellIndex: 0, notebookIndex: 0, section: 'implementasi', caption: '1', explanation: '1' }], preTestAnswers: [], postTestAnswers: [], stepByStepNarrative: '', codeAnalysis: '' },"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
