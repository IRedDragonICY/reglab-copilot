const fs = require('fs');
let content = fs.readFileSync('src/components/settings-panel.tsx', 'utf8');

content = content.replace(
  /<div className="grid grid-cols-2 gap-2">/,
  "<div className={`grid gap-2 ${metadata.reportType === 'praktikum' ? 'grid-cols-2' : 'grid-cols-1'}`}>\n"
);

fs.writeFileSync('src/components/settings-panel.tsx', content);
