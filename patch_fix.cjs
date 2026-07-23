const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

code = code.replace(
  `{metadata.reportType === 'resume' ? <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1> : <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>}`,
  `metadata.reportType === 'resume' ? <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1> : <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>`
);

fs.writeFileSync('src/components/report-preview.tsx', code);
console.log("Patched syntax error successfully");
