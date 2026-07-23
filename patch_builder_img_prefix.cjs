const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

content = content.replace(
  /await createImagesParagraphs\(\[img\], String\(analysis\.caption\)\.replace\(\/\['"\]\/g, ''\), 'II', implImageIndex\);/g,
  "await createImagesParagraphs([img], String(analysis.caption).replace(/['\"]/g, ''), isResume ? '' : 'II', implImageIndex);"
);

content = content.replace(
  /await createImagesParagraphs\(\[img\], String\(analysis\.caption\)\.replace\(\/\['"\]\/g, ''\), 'III', postTestImageIndex\);/g,
  "await createImagesParagraphs([img], String(analysis.caption).replace(/['\"]/g, ''), isResume ? '' : 'III', postTestImageIndex);"
);

fs.writeFileSync('src/lib/docx/builder.ts', content);
