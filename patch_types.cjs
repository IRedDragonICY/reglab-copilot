const fs = require('fs');
let content = fs.readFileSync('src/lib/types.ts', 'utf8');

content = content.replace(
  /if \(metadata\.reportType === 'kuliah'\) \{/,
  "if (metadata.reportType === 'resume') {\n    return metadata.judulPertemuan || '[Judul Resume]';\n  }\n  if (metadata.reportType === 'kuliah') {"
);

fs.writeFileSync('src/lib/types.ts', content);
