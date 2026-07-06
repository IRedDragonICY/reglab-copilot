const fs = require('fs');
let content = fs.readFileSync('src/lib/store.ts', 'utf8');

content = content.replace("console.warn('[boot] hydration safety-net firing after 10000ms');", "console.warn('[boot] hydration safety-net firing after 1500ms');");
content = content.replace("}, 10000);", "}, 1500);");

fs.writeFileSync('src/lib/store.ts', content);
