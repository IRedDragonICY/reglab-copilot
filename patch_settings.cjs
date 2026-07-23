const fs = require('fs');
let code = fs.readFileSync('src/components/settings-panel.tsx', 'utf8');

// Change `metadata.reportType !== 'kuliah'` to `metadata.reportType === 'praktikum'`
code = code.replace(/{metadata\.reportType !== 'kuliah' && \(/g, "{metadata.reportType === 'praktikum' && (");

fs.writeFileSync('src/components/settings-panel.tsx', code);
