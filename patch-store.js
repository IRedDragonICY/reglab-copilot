const fs = require('fs');
const content = fs.readFileSync('src/lib/store.ts', 'utf8');

const withTimeoutCode = `
const withTimeout = <T>(promise: Promise<T>, ms: number = 1000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('IDB timeout')), ms))
  ]);
};

// Custom storage for Zustand using idb-keyval.
`;

const updatedContent = content.replace('// Custom storage for Zustand using idb-keyval.', withTimeoutCode);

fs.writeFileSync('src/lib/store.ts', updatedContent);
