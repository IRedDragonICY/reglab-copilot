const fs = require('fs');
let content = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

content = content.replace(
  /className=\{`\$\{metadata\.reportType === 'kuliah' \? 'mt-8 ' : 'pl-4 '\}/g,
  "className={`\\${metadata.reportType !== 'praktikum' ? 'mt-8 ' : 'pl-4 '}"
);

content = content.replace(
  /const chapterPrefix = metadata\.reportType === 'kuliah' \? 'III' : 'II';/g,
  "const chapterPrefix = metadata.reportType !== 'praktikum' ? 'III' : 'II';"
);

fs.writeFileSync('src/components/report-preview.tsx', content);
