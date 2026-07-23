const fs = require('fs');
let code = fs.readFileSync('src/lib/utils.ts', 'utf8');
code = code.replace(
  /export function yieldThread\(\): Promise<void> \{\s*return new Promise\(resolve => setTimeout\(resolve, 0\)\);\s*\}/,
  `let lastYieldTime = Date.now();\nexport function yieldThread(force = false): Promise<void> {\n  const now = Date.now();\n  if (!force && now - lastYieldTime < 24) {\n    return Promise.resolve();\n  }\n  lastYieldTime = now;\n  if (typeof window !== 'undefined' && window.MessageChannel) {\n    return new Promise(resolve => {\n      const channel = new MessageChannel();\n      channel.port1.onmessage = () => {\n        resolve();\n      };\n      channel.port2.postMessage(null);\n    });\n  }\n  return new Promise(resolve => setTimeout(resolve, 0));\n}`
);
fs.writeFileSync('src/lib/utils.ts', code);
