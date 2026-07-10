const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

code = code.replace(
  /di object `answers`\./g,
  "di object \\`answers\\`."
);

fs.writeFileSync('src/lib/ai/prompts.ts', code);
