const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /const vite = await createViteServer\(\{[\s\S]*?appType: 'spa',[\s\S]*?\}\);/g,
  `const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa',
    });`
);

fs.writeFileSync('server.ts', content);
