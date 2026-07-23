const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace(
  /hmr: false,/g,
  `hmr: process.env.DISABLE_HMR !== 'true',`
);

fs.writeFileSync('vite.config.ts', content);
