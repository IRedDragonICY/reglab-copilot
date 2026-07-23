const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/agent-loop.ts', 'utf8');

code = code.replace(/ && !completionRaised\)/g, ')');

fs.writeFileSync('src/lib/ai/agent-loop.ts', code);
