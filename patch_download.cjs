const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-report-download.ts', 'utf8');

code = code.replace(
  '        c.parsedNotebooks.length,\n      );',
  '        c.parsedNotebooks.length,\n        (msg) => {\n          if (toastId) toast.loading(msg, { id: toastId });\n        }\n      );'
);

fs.writeFileSync('src/hooks/use-report-download.ts', code);
