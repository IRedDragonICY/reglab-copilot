const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

// The prefix is `Gambar ${chapterPrefix ? chapterPrefix + '.' : ''}${nextImgIdxII++}` 
// Let's replace `Gambar II.\${nextImgIdxII++}` and `Gambar III.\${nextImgIdxIII++}` etc.

code = code.replace(/Gambar II\.\\\$\{nextImgIdxII\+\+\}/g, "Gambar \\${chapterPrefix ? chapterPrefix + '.' : ''}\\${nextImgIdxII++}");
code = code.replace(/Gambar III\.\\\$\{nextImgIdxIII\+\+\}/g, "Gambar \\${metadata.reportType === 'resume' ? '' : 'III.'}\\${nextImgIdxIII++}");
// there's also `Gambar II.\${nextImgIdxII \+ idx}`
code = code.replace(/Gambar II\.\\\$\{nextImgIdxII \+ idx\}/g, "Gambar \\${chapterPrefix ? chapterPrefix + '.' : ''}\\${nextImgIdxII + idx}");

fs.writeFileSync('src/components/report-preview.tsx', code);
