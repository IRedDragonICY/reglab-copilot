const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/schema.ts', 'utf8');

code = code.replace(
  /imageIndex: \{ type: Type\.NUMBER,/g,
  "imageCategory: { type: Type.STRING, enum: ['pre_test', 'implementasi', 'post_test', 'notebook'], description: 'Kategori/bucket asal gambar lampiran tersebut diupload. Wajib disesuaikan dengan label [KATEGORI UPLOAD] yang mendahului gambar.' },\n    imageIndex: { type: Type.NUMBER,"
);

fs.writeFileSync('src/lib/ai/schema.ts', code);
