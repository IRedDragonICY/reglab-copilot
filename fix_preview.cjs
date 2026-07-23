const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

const replacement1 = `            {metadata.reportType !== 'praktikum' ? (
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
            ) : (`;
code = code.replace(
  `            {metadata.reportType !== 'praktikum' ? (
              <>
                <TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold />
                <TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold />
                <TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold />
              </>
            ) : (`,
  replacement1
);


const replacement2 = `        {metadata.reportType !== 'praktikum' ? (
          <>
            {metadata.reportType === 'resume' ? (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN</h1>
            ) : (
              <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>
            )}
            <div 
              className="mt-8 text-gray-900 text-justify prose prose-sm max-w-none outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all"
              contentEditable suppressContentEditableWarning
              onBlur={(e) => {
                if (onAiDataChange && aiData) {
                  onAiDataChange({ ...aiData, pendahuluan: e.currentTarget.innerText });
                }
              }}
            >
              <MarkdownBlock content={pendahuluanText || modulContext || 'Belum ada context kajian/pendahuluan...'} />
            </div>
          </>
        ) : (`;
code = code.replace(
  `        {metadata.reportType !== 'praktikum' ? (
          <>
            <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>
            <div 
              className="mt-8 text-gray-900 text-justify prose prose-sm max-w-none outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all"
              contentEditable suppressContentEditableWarning
              onBlur={(e) => {
                if (onAiDataChange && aiData) {
                  onAiDataChange({ ...aiData, pendahuluan: e.currentTarget.innerText });
                }
              }}
            >
              <MarkdownBlock content={pendahuluanText || modulContext || 'Belum ada context kajian/pendahuluan...'} />
            </div>
          </>
        ) : (`,
  replacement2
);

const replacement3 = `        {metadata.reportType !== 'praktikum' ? (
          <>
            {metadata.reportType === 'resume' ? (
              <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PEMBAHASAN</h1>
            ) : (
              <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>
            )}
            <NotebookLinks links={notebookLinks} />
          </>
        ) : (`;
code = code.replace(
  `        {metadata.reportType !== 'praktikum' ? (
          <>
            <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>
            <NotebookLinks links={notebookLinks} />
          </>
        ) : (`,
  replacement3
);


const replacement4 = `          {metadata.reportType !== 'praktikum' ? (
            metadata.reportType === 'resume' ? (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>KESIMPULAN</h1>
            ) : (
              <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>
            )
          ) : (`;
code = code.replace(
  `          {metadata.reportType !== 'praktikum' ? (
            <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>
          ) : (`,
  replacement4
);


fs.writeFileSync('src/components/report-preview.tsx', code);
