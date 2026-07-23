const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace('const _state = useAppStore();\n  console.log("App render, state:", _state);', 'const hasHydrated = useAppStore((s) => s.hasHydrated);');
fs.writeFileSync('src/App.tsx', content);
