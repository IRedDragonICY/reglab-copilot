const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

const regex = /const liveSession = sessionArg \? store\.sessions\.find\(\(s: any\) => s\.id === sessionArg\.id\) \|\| sessionRef\.current \|\| sessionArg : null;/g;

code = code.replace(regex, `const liveSession = sessionArg ? useAppStore.getState().sessions.find((s: any) => s.id === sessionArg.id) || sessionRef.current || sessionArg : null;`);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', code);
