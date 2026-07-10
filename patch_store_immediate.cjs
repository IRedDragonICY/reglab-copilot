const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const replacement = `
  setItem: async (name: string, value: any): Promise<void> => {
    const win = window as any;
    if (win._idbWriteTimeout) {
      clearTimeout(win._idbWriteTimeout);
    }
    win._idbWriteTimeout = setTimeout(async () => {
      try {
        await idbSet(name, value);
      } catch (e) {
        console.error('IDB set failed', e);
      }
    }, 500);
    // Resolve immediately to not block Zustand's persist queue
    return Promise.resolve();
  },`;

code = code.replace(
  /setItem:\s*async\s*\(name:\s*string,\s*value:\s*any\):\s*Promise<void>\s*=>\s*\{[\s\S]*?\},/g,
  replacement
);

fs.writeFileSync('src/lib/store.ts', code);
