const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');
code = code.split('generate_report').join('add_cell_analysis');
fs.writeFileSync('src/lib/ai/prompts.ts', code);
