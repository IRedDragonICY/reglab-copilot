const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

if (!code.includes('reorderTabs:')) {
  code = code.replace(
    'closeTab: (tabId: string) => void;',
    'closeTab: (tabId: string) => void;\n  reorderTabs: (newTabs: { id: string; title: string; type: "home" | "session" }[]) => void;'
  );

  code = code.replace(
    /closeTab:\s*\(tabId\)\s*=>\s*\{/,
    `reorderTabs: (newTabs) => set({ openTabs: newTabs }),\n      closeTab: (tabId) => {`
  );
  fs.writeFileSync('src/lib/store.ts', code);
}
