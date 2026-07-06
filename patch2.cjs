const fs = require('fs');
let code = fs.readFileSync('src/hooks/use-report-download.ts', 'utf8');
code = code.replace(
  /c\.setGeneratedDocxBlob\(blob\);\s*\}\s*if \(\!blob\) \{/,
  `c.setGeneratedDocxBlob(blob);
    }

    if (toastId) toast.dismiss(toastId);

    if (!blob) {`
);
fs.writeFileSync('src/hooks/use-report-download.ts', code);
