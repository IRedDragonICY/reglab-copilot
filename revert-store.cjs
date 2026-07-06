const fs = require('fs');
let content = fs.readFileSync('src/lib/store.ts', 'utf8');

content = content.replace('const raw = (await withTimeout(idbGet(name))) || null;', 'const raw = (await idbGet(name)) || null;');
content = content.replace('await withTimeout(idbSet(name, value));', 'await idbSet(name, value);');
content = content.replace('await withTimeout(idbDel(name));', 'await idbDel(name);');

// Remove withTimeout definition
content = content.replace(/const withTimeout = <T>\(promise: Promise<T>, ms: number = 1000\): Promise<T> => {[\s\S]*?};\n\n/g, '');

fs.writeFileSync('src/lib/store.ts', content);
