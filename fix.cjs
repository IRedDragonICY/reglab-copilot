const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

code = code.replace(/Panggil \\\`generate_report\\\`/g, 'Panggil tool granular seperti \\`add_cell_analysis\\` secara paralel');
code = code.replace(/memanggil fungsi \\\`generate_report\\\`/g, 'memanggil tool (lalu panggil \\`mark_task_complete\\` di akhir)');
code = code.replace(/generate_report/g, 'add_cell_analysis');

fs.writeFileSync('src/lib/ai/prompts.ts', code);
