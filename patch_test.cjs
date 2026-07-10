const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.test.ts', 'utf8');

code = code.replace(
  /it\.each\(\[\s*'Pada gambar di atas dapat dilihat',\s*'Seperti yang terlihat pada gambar',\s*'Berdasarkan tampilan di atas',\s*'Gambar di atas menunjukkan',\s*'Dapat disimpulkan bahwa',\s*'Output dari kode di atas adalah',\s*\]\)/g,
  `it.each([
    'Pada gambar di atas dapat dilihat',
    'Berdasarkan output tersebut',
    'Gambar ini menunjukkan',
    'Potongan kode di atas berfungsi untuk',
  ])`
);

fs.writeFileSync('src/lib/ai/prompts.test.ts', code);
