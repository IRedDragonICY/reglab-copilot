const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-report-download.ts', 'utf8');

code = code.replace(
  /        c\.parsedNotebooks\.length,\s*\);\s*c\.setGeneratedDocxBlob\(blob\);/g,
  `        c.parsedNotebooks.length,
        (msg) => {
          if (toastId) toast.loading(msg, { id: toastId });
        }
      );
      c.setGeneratedDocxBlob(blob);`
);

fs.writeFileSync('src/hooks/use-report-download.ts', code);
