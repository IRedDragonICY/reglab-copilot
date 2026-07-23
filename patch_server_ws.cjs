const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes("import http from 'http';")) {
  content = content.replace("import express from 'express';", "import express from 'express';\nimport http from 'http';");
}

content = content.replace("const app = express();", "const app = express();\n  const httpServer = http.createServer(app);");

content = content.replace(
  /const vite = await createViteServer\(\{[\s\S]*?appType: 'spa',[\s\S]*?\}\);/g,
  `const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
          clientPort: 443
        }
      },
      appType: 'spa',
    });`
);

content = content.replace(/app\.listen\(PORT/g, "httpServer.listen(PORT");

fs.writeFileSync('server.ts', content);
