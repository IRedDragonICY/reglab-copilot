const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

content = content.replace(/const isEventResume = [^;]+;/, 'const isEventResume = ctx.isResume;');

fs.writeFileSync('src/lib/ai/prompts.ts', content);
