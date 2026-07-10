const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const newIdbSet = `
let writeTimeout = null;
let writePromise = Promise.resolve();
  setItem: async (name, value) => {
    return new Promise((resolve) => {
      if (writeTimeout) clearTimeout(writeTimeout);
      writeTimeout = setTimeout(async () => {
        try {
          await writePromise;
          writePromise = idbSet(name, value);
          await writePromise;
        } catch (e) {
          console.error('IDB set failed', e);
        }
        resolve();
      }, 500);
    });
  },`;

code = code.replace(
  `  setItem: async (name: string, value: any): Promise<void> => {
    await idbSet(name, value);
  },`,
  `  setItem: async (name: string, value: any): Promise<void> => {
    return new Promise((resolve) => {
      if ((window as any)._idbWriteTimeout) clearTimeout((window as any)._idbWriteTimeout);
      (window as any)._idbWriteTimeout = setTimeout(async () => {
        try {
          await idbSet(name, value);
        } catch (e) {
          console.error('IDB set failed', e);
        }
        resolve();
      }, 300);
    });
  },`
);

fs.writeFileSync('src/lib/store.ts', code);
