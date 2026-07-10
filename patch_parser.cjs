const fs = require('fs');
let code = fs.readFileSync('src/lib/parser.ts', 'utf8');

code = code.replace(
  /sourceLower\.includes\('post test'\) \|\| sourceLower\.includes\('post-test'\)/g,
  "sourceLower.includes('post test') || sourceLower.includes('post-test') || sourceLower.includes('posttest') || sourceLower.includes('tugas')"
);

fs.writeFileSync('src/lib/parser.ts', code);
