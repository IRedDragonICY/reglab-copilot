const fs = require('fs');
let content = fs.readFileSync('src/lib/store.ts', 'utf8');

const withTimeoutCode = `
const withTimeout = <T>(promise: Promise<T>, ms: number = 1000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('IDB timeout')), ms))
  ]);
};

// Custom storage for Zustand using idb-keyval.`;

content = content.replace('// Custom storage for Zustand using idb-keyval.', withTimeoutCode);

// Then update idbStorage to use withTimeout
content = content.replace('const raw = (await idbGet(name)) || null;', 'const raw = (await withTimeout(idbGet(name))) || null;');
content = content.replace('await idbSet(name, value);', 'await withTimeout(idbSet(name, value));');
content = content.replace('await idbDel(name);', 'await withTimeout(idbDel(name));');

fs.writeFileSync('src/lib/store.ts', content);
