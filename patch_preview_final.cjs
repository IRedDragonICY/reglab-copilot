const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

// Fix 1: TocItem block
code = code.replace(
/\{\s*metadata\.reportType !== 'praktikum' \? \(\s*<>\s*metadata\.reportType === 'resume' \? \(\s*<>\s*<TocItem title="PENDAHULUAN" page="1" id="pre-test" isBold \/>\s*<TocItem title="PEMBAHASAN" page="2" id="hasil-praktikum" isBold \/>\s*<TocItem title="KESIMPULAN" page="4" id="analisis-hasil" isBold \/>\s*<\/>\s*\) : \(\s*<>\s*<TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold \/>\s*<TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold \/>\s*<TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold \/>\s*<\/>\s*\)\}\s*<\/>\s*\) : \(/g,
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

// Fix 2: BAB I PENDAHULUAN block
code = code.replace(
/\{\s*metadata\.reportType !== 'praktikum' \? \(\s*metadata\.reportType === 'resume' \? \(\s*<h1 id="pre-test"[^>]*>PENDAHULUAN<\/h1>\s*\) : \(\s*<h1 id="pre-test"[^>]*>BAB I<br\/>PENDAHULUAN<\/h1>\s*\)\}\s*\)/g,
`{metadata.reportType !== 'praktikum' ? (
            metadata.reportType === 'resume' ? (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN</h1>
            ) : (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>
            )
          )`
);

// Fix 3: BAB III KESIMPULAN block
code = code.replace(
/\{\s*metadata\.reportType !== 'praktikum' \? \(\s*metadata\.reportType === 'resume' \? \(\s*<h1 id="analisis-hasil"[^>]*>KESIMPULAN<\/h1>\s*\) : \(\s*<h1 id="analisis-hasil"[^>]*>BAB III<br\/>KESIMPULAN<\/h1>\s*\)\}\s*\)/g,
`{metadata.reportType !== 'praktikum' ? (
            metadata.reportType === 'resume' ? (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1>
            ) : (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>
            )
          )`
);

fs.writeFileSync('src/components/report-preview.tsx', code);
