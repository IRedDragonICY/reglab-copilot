const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

// Replace TocItem logic
code = code.replace(
  /{metadata\.reportType !== 'praktikum' \? \([\s\S]*?<>[\s\S]*?metadata\.reportType === 'resume' \? \([\s\S]*?<>[\s\S]*?<TocItem title="PENDAHULUAN" page="1" id="pre-test" isBold \/>[\s\S]*?<TocItem title="PEMBAHASAN" page="2" id="hasil-praktikum" isBold \/>[\s\S]*?<TocItem title="KESIMPULAN" page="4" id="analisis-hasil" isBold \/>[\s\S]*?<\/>[\s\S]*?\) : \([\s\S]*?<>[\s\S]*?<TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold \/>[\s\S]*?<TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold \/>[\s\S]*?<TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold \/>[\s\S]*?<\/>[\s\S]*?\)\}*[\s\S]*?<\/>[\s\S]*?\) : \(/g,
  `{metadata.reportType !== 'praktikum' ? (
              metadata.reportType === 'resume' ? (
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
              )
            ) : (`
);

// Replace Pre-Test logic
code = code.replace(
  /{metadata\.reportType !== 'praktikum' \? \([\s\S]*?<>[\s\S]*?metadata\.reportType === 'resume' \? \([\s\S]*?<h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN<\/h1>[\s\S]*?\) : \([\s\S]*?<h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br\/>PENDAHULUAN<\/h1>[\s\S]*?\)\}*[\s\S]*?<div/g,
  `{metadata.reportType !== 'praktikum' ? (
            metadata.reportType === 'resume' ? (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN</h1>
            ) : (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>
            )
          ) : null}
          <div`
);

// Replace Post-Test logic
code = code.replace(
  /{metadata\.reportType !== 'praktikum' \? \([\s\S]*?metadata\.reportType === 'resume' \? \([\s\S]*?<h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN<\/h1>[\s\S]*?\) : \([\s\S]*?<h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br\/>KESIMPULAN<\/h1>[\s\S]*?\)\}*[\s\S]*?\) : \(/g,
  `{metadata.reportType !== 'praktikum' ? (
            metadata.reportType === 'resume' ? (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1>
            ) : (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>
            )
          ) : (`
);

fs.writeFileSync('src/components/report-preview.tsx', code);
