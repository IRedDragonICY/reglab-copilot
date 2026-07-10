const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const replacement = `
  setItem: async (name: string, value: any): Promise<void> => {
    return new Promise((resolve) => {
      const win = window as any;
      if (win._idbWriteTimeout) {
        clearTimeout(win._idbWriteTimeout);
        if (win._idbWriteResolve) win._idbWriteResolve();
      }
      win._idbWriteResolve = resolve;
      win._idbWriteTimeout = setTimeout(async () => {
        try {
          await idbSet(name, value);
        } catch (e) {
          console.error('IDB set failed', e);
        }
        if (win._idbWriteResolve) {
          win._idbWriteResolve();
          win._idbWriteResolve = null;
        }
      }, 500);
    });
  },`;

code = code.replace(
  /setItem:\s*async\s*\(name:\s*string,\s*value:\s*any\):\s*Promise<void>\s*=>\s*\{[\s\S]*?\},/g,
  replacement
);

fs.writeFileSync('src/lib/store.ts', code);
