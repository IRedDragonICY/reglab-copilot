const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

code = code.replace(
  /return Promise\.resolve\(\);\n\s*\}, 500\);\n\s*\}\);\n\s*\}/,
  "return Promise.resolve();\n  }"
);

fs.writeFileSync('src/lib/store.ts', code);
