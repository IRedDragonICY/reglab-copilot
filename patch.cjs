const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

code = code.replace(
  '<TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold />',
  `{metadata.reportType === 'resume' ? <TocItem title="PENDAHULUAN" page="1" id="pre-test" isBold /> : <TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold />}`
);

code = code.replace(
  '<TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold />',
  `{metadata.reportType === 'resume' ? <TocItem title="PEMBAHASAN" page="2" id="hasil-praktikum" isBold /> : <TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold />}`
);

code = code.replace(
  '<TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold />',
  `{metadata.reportType === 'resume' ? <TocItem title="KESIMPULAN" page="4" id="analisis-hasil" isBold /> : <TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold />}`
);

code = code.replace(
  '<h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>',
  `{metadata.reportType === 'resume' ? <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN</h1> : <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>}`
);

code = code.replace(
  '<h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>',
  `{metadata.reportType === 'resume' ? <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PEMBAHASAN</h1> : <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>}`
);

code = code.replace(
  '<h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>',
  `{metadata.reportType === 'resume' ? <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1> : <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>}`
);

fs.writeFileSync('src/components/report-preview.tsx', code);
console.log("Patched successfully");
