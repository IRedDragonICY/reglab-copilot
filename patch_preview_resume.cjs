const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

code = code.replace(
  /<h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br\/>PENDAHULUAN<\/h1>/g,
  `{metadata.reportType === 'resume' ? (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN</h1>
            ) : (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>
            )}`
);

code = code.replace(
  /<h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br\/>PEMBAHASAN<\/h1>/g,
  `{metadata.reportType === 'resume' ? null : (
              <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>
            )}`
);

code = code.replace(
  /<h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br\/>KESIMPULAN<\/h1>/g,
  `{metadata.reportType === 'resume' ? (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1>
            ) : (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>
            )}`
);

// We should also modify TocItem generation for resume!
code = code.replace(
  /<TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold \/>\s*<TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold \/>\s*<TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold \/>/g,
  `{metadata.reportType === 'resume' ? (
                  <>
                    <TocItem title="PENDAHULUAN" page="1" id="pre-test" isBold />
                    <TocItem title="PEMBAHASAN" page="2" id="hasil-praktikum" isBold />
                    <TocItem title="KESIMPULAN" page="4" id="analisis-hasil" isBold />
                  </>
                ) : (
                  <>
                    <TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold />
                    <TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold />
                    <TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold />
                  </>
                )}`
);

// We should also replace the chapterPrefix mapping
code = code.replace(
  /const chapterPrefix = metadata\.reportType !== 'praktikum' \? 'III' : 'II';/g,
  `const chapterPrefix = metadata.reportType === 'resume' ? '' : (metadata.reportType !== 'praktikum' ? 'III' : 'II');`
);

// And we should check the `Gambar II.X` generation in `report-preview.tsx` for resume. 
// For resume, maybe just `Gambar X` without chapter prefix?
// There are multiple places with `` Gambar II.${nextImgIdxII++} ``
// Let's find them.

fs.writeFileSync('src/components/report-preview.tsx', code);
