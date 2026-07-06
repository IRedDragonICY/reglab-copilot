const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

code = code.replace(
  '  const isKuliah = metadata.reportType === \'kuliah\';',
  '  if (onProgress) onProgress("Membangun cover halaman...");\n  const isKuliah = metadata.reportType === \'kuliah\';'
);

code = code.replace(
  '  frontChildren.push(',
  '  if (onProgress) onProgress("Membangun bab pendahuluan...");\n  frontChildren.push('
);

code = code.replace(
  '  if (isKuliah && aiData.modulReview) {',
  '  if (onProgress) onProgress("Membangun ringkasan...");\n  if (isKuliah && aiData.modulReview) {'
);

code = code.replace(
  '  if (!isKuliah && postTest) {',
  '  if (onProgress) onProgress("Memproses post-test...");\n  if (!isKuliah && postTest) {'
);

code = code.replace(
  '  if (aiData.closingRemarks) {',
  '  if (onProgress) onProgress("Menyusun kesimpulan...");\n  if (aiData.closingRemarks) {'
);

code = code.replace(
  '  const doc = new Document({',
  '  if (onProgress) onProgress("Merender dokumen final...");\n  const doc = new Document({'
);

code = code.replace(
  '  return Packer.toBlob(doc);',
  '  const blob = await Packer.toBlob(doc);\n  if (onProgress) onProgress("Selesai!");\n  return blob;'
);

fs.writeFileSync('src/lib/docx/builder.ts', code);
