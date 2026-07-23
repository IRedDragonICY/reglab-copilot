const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

content = content.replace(
  /callbacks: \{\},\s*sysMsgBuilder: \(loop\) => `Continue batch \$\{loop\}`,/s,
  "sysMsgBuilder: (loop) => `Continue batch ${loop}`,"
);

content = content.replace(
  /declarationKey: 'praktikum',/g,
  "declaration: { name: 'generate_report', description: 'desc', parameters: { type: 'OBJECT', properties: {} } } as any, sysMsgBuilder: () => 'test', mode: 'append',"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
