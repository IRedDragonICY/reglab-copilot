const fs = require('fs');
let code = fs.readFileSync('src/lib/store.test.ts', 'utf8');

code = code.replace(
  'setCopilotSettings({ maxIterations: 99 });',
  'setCopilotSettings({ maxIterations: 1000 });'
);

code = code.replace(
  'expect(useAppStore.getState().copilotSettings.maxIterations).toBe(30);',
  'expect(useAppStore.getState().copilotSettings.maxIterations).toBe(999);'
);

fs.writeFileSync('src/lib/store.test.ts', code);
