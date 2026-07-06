const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

const regex = /if\s*\(sessionArg\)\s*\{\s*store\.saveSession\(\{\s*\.\.\.sessionArg,\s*title:\s*metadata\.judulPertemuan,\s*aiData:\s*accumulatedAiData,\s*\}\);\s*\}/g;

code = code.replace(regex, `const liveSession = sessionArg ? store.sessions.find((s: any) => s.id === sessionArg.id) || sessionRef.current || sessionArg : null;
      if (liveSession) {
        store.saveSession({
          ...liveSession,
          title: metadata.judulPertemuan,
          aiData: accumulatedAiData,
        });
      }`);

fs.writeFileSync('src/hooks/use-copilot-ai.ts', code);
