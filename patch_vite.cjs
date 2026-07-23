const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace(
  /hmr: process\.env\.DISABLE_HMR !== 'true',/g,
  `hmr: false,`
);

fs.writeFileSync('vite.config.ts', content);
