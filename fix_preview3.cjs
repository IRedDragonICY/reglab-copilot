const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

const targetStr = `            ) : (
          <>
            <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black" contentEditable suppressContentEditableWarning>II. Hasil Praktikum</h1>`;

const replacement = `            ) : (
              <>
                <TocItem title="I. Pre Test" page="1" id="pre-test" isBold />
                <TocItem title="II. Hasil Praktikum" page="2" id="hasil-praktikum" isBold />
                <TocItem title="A. Alat dan Bahan" page="2" id="alat-bahan" indent />
                <TocItem title="B. Langkah Kerja" page="2" id="langkah-kerja" indent />
                <TocItem title="C. Implementasi/Screenshot" page="3" id="implementasi" indent />
                <TocItem title="D. Analisis Hasil" page="4" id="analisis-hasil" indent />
                <TocItem title="III. Post Test" page="5" id="post-test" isBold />
              </>
            )}
          </div>
        </div>
      </PreviewPage>

      {/* 3. Daftar Gambar */}
      <PreviewPage studentName={metadata.nama} pageNumber="II">
        <h1 id="daftar-gambar" className="text-xl font-bold scroll-mt-8 text-center text-black mb-8">DAFTAR GAMBAR</h1>
        <div className="space-y-4 font-serif leading-relaxed text-sm text-black">
          {allImageMocks.length > 0 ? allImageMocks.map((title, i) => (
            <TocItem key={i} title={title} page="-" />
          )) : (
            <p className="text-gray-500 italic text-center">Tidak ada gambar</p>
          )}
        </div>
      </PreviewPage>

      {/* 4. Daftar Kode Program */}
      <PreviewPage studentName={metadata.nama} pageNumber="III">
        <h1 id="daftar-kode-program" className="text-xl font-bold scroll-mt-8 text-center text-black mb-8">DAFTAR KODE PROGRAM</h1>
        <div className="space-y-4 font-serif leading-relaxed text-sm text-black">
          {allCodeMocks.length > 0 ? allCodeMocks.map((title, i) => (
            <TocItem key={i} title={title} page="-" />
          )) : (
            <p className="text-gray-500 italic text-center">Tidak ada kode program</p>
          )}
        </div>
      </PreviewPage>

      {/* 5. Pre Test / Pendahuluan */}
      <PreviewPage studentName={metadata.nama} pageNumber="1">
        {metadata.reportType !== 'praktikum' ? (
          metadata.reportType === 'resume' ? (
            <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>PENDAHULUAN</h1>
          ) : (
            <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB I<br/>PENDAHULUAN</h1>
          )
        ) : (
          <>
            <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black" contentEditable suppressContentEditableWarning>I. Pre Test</h1>
            {preTestImages.length > 0 && (
              <div className="mt-8 space-y-8">
                {preTestImages.map((img, idx) => (
                  <PreviewImage key={img.id} src={img.dataUrl} caption={\`Gambar I.\${idx + 1} Lembar Jawaban Pre-Test\`} />
                ))}
              </div>
            )}
          </>
        )}
        <div 
          className="mt-8 text-gray-900 text-justify prose prose-sm max-w-none outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all"
          contentEditable suppressContentEditableWarning
          onBlur={(e) => {
            if (onAiDataChange && aiData) {
              const newAiData = { ...aiData };
              if (metadata.reportType === 'praktikum') {
                if (!newAiData.preTestAnswers) {
                  newAiData.preTestAnswers = ((newAiData as any).pre_test?.questions || []).map((q: string, i: number) => ({ q, a: (newAiData as any).pre_test?.answers?.[i] || '' }));
                }
              } else {
                newAiData.pendahuluan = e.target.innerText;
              }
              onAiDataChange(newAiData);
            }
          }}
        >
          {metadata.reportType === 'praktikum' ? (
            <MarkdownBlock content={\`\${preTestAnswersArray.map((qa: any, idx: number) => \`**Soal \${idx+1}:** \${qa.q}\\n**Jawab:** \${qa.a}\`).join('\\n\\n')}\`} />
          ) : (
            <MarkdownBlock content={pendahuluanText || modulContext || 'Tidak ada teks pendahuluan'} />
          )}
        </div>
      </PreviewPage>

      {/* 6. Hasil Praktikum / Pembahasan */}
      <PreviewPage studentName={metadata.nama} pageNumber="2">
        {metadata.reportType !== 'praktikum' ? (
          metadata.reportType === 'resume' ? null : (
            <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>
          )
        ) : (
          <>
            <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black" contentEditable suppressContentEditableWarning>II. Hasil Praktikum</h1>`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/components/report-preview.tsx', code);
