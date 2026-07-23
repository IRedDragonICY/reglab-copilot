const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

// Replace all occurrences of `Gambar ${bab}.${index}` with `Gambar ${bab ? bab + '.' : ''}${index}`
content = content.replace(/\`Gambar \$\{bab\}\.\$\{index\}/g, "`Gambar ${bab ? bab + '.' : ''}${index}");

fs.writeFileSync('src/lib/docx/notebook.ts', content);
