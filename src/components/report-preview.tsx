import React from 'react';
import { useEffect, useRef } from 'react';
import { ReportMetadata, AIReportData, UserImage, getFormattedJudulPertemuan } from '@/lib/types';
import { ParsedNotebook, categorizeNotebookCells } from '@/lib/parser';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useAppStore } from '@/lib/store';

const pythonKeywords = new Set(['def', 'class', 'import', 'from', 'as', 'return', 'if', 'elif', 'else', 'while', 'for', 'in', 'try', 'except', 'finally', 'pass', 'break', 'continue', 'with', 'yield', 'True', 'False', 'None', 'and', 'or', 'not']);
const pythonBuiltins = new Set(['print', 'len', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple', 'open', 'range']);

const escapeHtml = (unsafe: string) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

export const highlightPython = (code: string) => {
  const tokens = code.split(/(\s+|#.*|"[^"]*"|'[^']*'|[a-zA-Z_]\w*|\W)/).filter(Boolean);
  return tokens.map(token => {
    if (token.startsWith('#')) return `<span style="color: #008000">${escapeHtml(token)}</span>`;
    if (token.startsWith('"') || token.startsWith("'")) return `<span style="color: #A31515">${escapeHtml(token)}</span>`;
    if (pythonKeywords.has(token)) return `<span style="color: #0000FF; font-weight: bold">${escapeHtml(token)}</span>`;
    if (pythonBuiltins.has(token)) return `<span style="color: #795E26">${escapeHtml(token)}</span>`;
    if (/^[0-9]+(\.[0-9]+)?$/.test(token)) return `<span style="color: #098658">${escapeHtml(token)}</span>`;
    return escapeHtml(token);
  }).join('');
};

const markdownComponents = {
  img: ({ node, src, ...props }: any) => {
    if (!src) return null;
    // FIX: Penyelarasan vertikal agar rumus inline math bisa sejajar dengan teks
    return <img src={src} {...props} alt={props.alt || ''} className="inline-block align-middle" />;
  }
};

function MarkdownBlock({ content }: { content: string }) {
  if (!content) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

interface PreviewPageProps {
  studentName?: string;
  pageNumber?: React.ReactNode;
  children: React.ReactNode;
  isCover?: boolean;
}

function PreviewPage({ studentName, pageNumber, children, isCover }: PreviewPageProps) {
  if (isCover) {
    return (
      <div className="bg-white text-black w-[816px] max-w-full min-h-[1056px] p-10 sm:p-20 flex flex-col items-center justify-between relative ring-1 ring-[#1F1F1F]">
        {children}
      </div>
    );
  }
  return (
    <div className="bg-white text-black w-[816px] max-w-full min-h-[1056px] p-10 sm:p-20 relative outline-none flex flex-col justify-between ring-1 ring-[#1F1F1F]">
      <div className="absolute top-8 left-10 right-10 text-xs text-gray-500 font-serif pb-2 border-b border-gray-300">
        {studentName || 'Nama Mahasiswa'}
      </div>
      <div className="space-y-8 mt-4 flex-1 text-black">
        {children}
      </div>
      {pageNumber !== undefined && (
        <div className="absolute bottom-8 left-10 right-10 text-center text-xs text-gray-500 font-serif pt-2 border-t border-gray-300">
          {pageNumber}
        </div>
      )}
    </div>
  );
}

function PreviewImage({ src, caption, alt }: { src: string, caption: string, alt?: string }) {
  if (!src) return null;
  return (
    <div className="text-center my-6 bg-white p-2 rounded">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt || caption} className="max-w-full h-auto mx-auto border border-gray-300 shadow-sm rounded" />
      <p className="mt-3 text-sm text-gray-800 font-bold">{caption}</p>
    </div>
  );
}

function TocItem({ title, page, id, isBold = false, indent = false }: { title: string, page: string | number, id?: string, isBold?: boolean, indent?: boolean }) {
  return (
    <a href={id ? `#${id}` : undefined} className={`flex justify-between items-end relative ${indent ? 'pl-6 mt-2' : 'mt-6'} hover:text-blue-600 transition-colors cursor-pointer`}>
      <span className={`${isBold ? 'font-bold' : ''} bg-white pr-2 z-10 relative`}>{title}</span>
      <div className={`absolute ${indent ? 'left-6' : 'left-0'} right-0 bottom-1 border-b-[2px] border-dotted border-gray-400`}></div>
      <span className="bg-white pl-2 z-10 relative">{page}</span>
    </a>
  );
}

function NotebookLinks({ links, title = "Link Notebook:" }: { links: string[], title?: string }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="mt-4 pl-4 text-sm">
      <p className="font-bold text-black mb-1">{title}</p>
      {links.map((link, i) => (
        <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline block mb-1">
          {link}
        </a>
      ))}
    </div>
  );
}

function QAList({ items }: { items: any[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-4">
      {items.map((item: any, idx: number) => (
        <div key={idx} className="outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all" contentEditable suppressContentEditableWarning>
          <div className="font-medium mb-1 text-black flex gap-2">
            <span className="shrink-0">{idx + 1}.</span>
            <div className="prose prose-sm max-w-none text-black">
              <MarkdownBlock content={item.q.replace(/^[A-Z\d]+\.\s*/i, '')} />
            </div>
          </div>
          <div className="pl-4 text-gray-900 text-justify flex gap-2">
            <div className="prose prose-sm max-w-none text-gray-900 w-full">
              <div className="font-bold mb-1">Jawaban:</div>
              <MarkdownBlock content={item.a} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface ReportPreviewProps {
  metadata: ReportMetadata;
  notebooks: (ParsedNotebook | null)[];
  aiData: AIReportData;
  preTestImages: UserImage[];
  implImages: UserImage[];
  postTestImages: UserImage[];
  modulContext?: string;
  postTest?: string;
  onAiDataChange?: (data: AIReportData) => void;
  onMetadataChange?: (data: ReportMetadata) => void;
}

function ReportPreviewInner({
  metadata, notebooks, aiData, preTestImages, implImages, postTestImages,
  modulContext = '', postTest = '', onAiDataChange
}: ReportPreviewProps) {
  
  // Selection-aware editing: when the user releases the mouse over a
  // selected portion of the preview, capture the highlighted text and
  // stash it on the store. The Copilot composer reads the slice and
  // surfaces it as a context chip; sending the next message scopes the
  // edit to that text. Cleared on collapsed selection or on click
  // outside.
  const previewRef = useRef<HTMLDivElement | null>(null);
  const setSelectionContext = useAppStore((s) => s.setSelectionContext);
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    const onUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text || text.length < 4) return;
      // Only capture selections that originate inside the preview.
      const anchor = sel.anchorNode;
      if (!anchor || !root.contains(anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement)) {
        return;
      }
      // Walk up to find a section header (h1/h2 with id) so the chip
      // can show "B. Langkah Kerja → …" instead of just the raw text.
      let field: string | undefined;
      let cursor: Node | null = anchor;
      while (cursor && cursor !== root) {
        const el = cursor.nodeType === 1 ? (cursor as Element) : cursor.parentElement;
        if (!el) break;
        // Look for the nearest preceding heading sibling chain.
        const heading = el.closest('[id]');
        if (heading && heading instanceof HTMLElement && heading.tagName.match(/^H[1-3]$/)) {
          field = heading.innerText.trim();
          break;
        }
        cursor = el.parentElement;
      }
      setSelectionContext({ text, field });
    };
    root.addEventListener('mouseup', onUp);
    return () => root.removeEventListener('mouseup', onUp);
  }, [setSelectionContext]);

  const cellAnalysesArray = aiData.cellAnalyses || (aiData as any).praktikum?.cellAnalyses || (aiData as any).kuliah?.cellAnalyses;
  const preTestAnswersArray = aiData.preTestAnswers || ((aiData as any).pre_test?.questions ||[]).map((q: string, i: number) => ({ q, a: (aiData as any).pre_test?.answers?.[i] || '' }));
  const postTestAnswersArray = aiData.postTestAnswers || ((aiData as any).post_test?.questions ||[]).map((q: string, i: number) => ({ q, a: (aiData as any).post_test?.answers?.[i] || '' }));
  const narrative = aiData.stepByStepNarrative || (aiData as any).praktikum?.langkah_kerja || '';
  const cAnalysis = aiData.codeAnalysis || (aiData as any).praktikum?.analisis_hasil || (aiData as any).kuliah?.analisis_hasil || '';
  const pendahuluanText = aiData.pendahuluan || (aiData as any).kuliah?.pendahuluan || '';

  const notebookLinks: string[] = [];
  const postTestNotebookLinks: string[] =[];
  
  const notebookLinkRegex = /https:\/\/(colab\.research\.google\.com|www\.kaggle\.com)\/[^\s]+/g;

  if (modulContext) {
    const matches = modulContext.match(notebookLinkRegex);
    if (matches) matches.forEach(link => { if (!notebookLinks.includes(link)) notebookLinks.push(link); });
  }

  const ptText = postTest || (postTestAnswersArray ||[]).map((item: any) => `${item.q} ${item.a}`).join(' ');
  const ptMatches = ptText.match(notebookLinkRegex);
  if (ptMatches) {
    ptMatches.forEach(link => { if (!postTestNotebookLinks.includes(link)) postTestNotebookLinks.push(link); });
  }

  const renderNotebookCells = (
    cells: { cell: any, index: number, notebookIndex: number }[],
    chapterPrefix: string,
    startCodeIndex: number,
    startImageIndex: number
  ) => {
    let codeIdx = startCodeIndex;
    let imgIdx = startImageIndex;

    const elements = cells.map(({ cell, index, notebookIndex }, idx) => {
      if (cell.cell_type === 'markdown' && cell.source.trim()) {
        return (
          <div key={idx} className="prose prose-sm max-w-none text-gray-900 my-4 text-justify">
            <MarkdownBlock content={cell.source} />
          </div>
        );
      } else if (cell.cell_type === 'code' && cell.source.trim()) {
        const currentCodeIndex = codeIdx++;
        const analysis = cellAnalysesArray?.find((a: any) => 
          a.cellIndex === index && (a.notebookIndex === undefined || a.notebookIndex === notebookIndex)
        );

        const caption = analysis?.caption || 'Blok Kode';
        const tableCaption = analysis?.tableCaption || analysis?.caption || 'Output Visual';

        const textOutputs = cell.outputs?.filter((o: any) => o.type === 'text' && o.content.trim()) ||[];
        const htmlOutputs = cell.outputs?.filter((o: any) => o.type === 'html' && o.content.trim()) ||[];
        const imageOutputs = cell.outputs?.filter((o: any) => o.type === 'image') ||[];

        return (
          <div key={idx} className="space-y-4 text-black">
            <div className="border border-gray-300 rounded flex flex-col overflow-hidden">
              <div className="p-4 bg-gray-50 overflow-x-auto">
                <div className="text-sm font-mono text-gray-800">
                  {cell.source.split('\n').map((line: string, i: number) => (
                    <div key={i} className="flex">
                      <span className="text-gray-400 select-none mr-2 w-8 shrink-0 text-right">{i + 1} |</span>
                      <span className="whitespace-pre-wrap break-words flex-1" dangerouslySetInnerHTML={{ __html: highlightPython(line) }} />
                    </div>
                  ))}
                </div>
              </div>
              
              {textOutputs.length > 0 && (
                <div className="border-t border-gray-300 p-4 bg-white overflow-x-auto">
                  {textOutputs.map((out: any, oIdx: number) => (
                    <pre key={oIdx} className="text-sm font-mono whitespace-pre-wrap text-gray-800">{out.content}</pre>
                  ))}
                </div>
              )}

              {htmlOutputs.length > 0 && (
                <div className="border-t border-gray-300 p-4 bg-white overflow-x-auto">
                  {htmlOutputs.map((out: any, oIdx: number) => (
                    <div key={oIdx} className="flex flex-col items-center">
                      <div className="w-full" dangerouslySetInnerHTML={{ __html: out.content }} />
                      <p className="mt-3 text-sm text-gray-800 font-bold text-center">Gambar {chapterPrefix}.{imgIdx++} {tableCaption}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-sm text-gray-800 font-bold mt-2">Kode Program {chapterPrefix}.{currentCodeIndex} {caption}</p>
            
            <div 
              contentEditable suppressContentEditableWarning 
              className={`prose prose-sm max-w-none my-4 text-justify outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all ${
                (!analysis || !analysis.explanation) ? "text-gray-400 italic empty:before:content-['Tambahkan_penjelasan_di_sini...']" : "text-gray-900"
              }`}
              onBlur={(e) => {
                if (onAiDataChange && cellAnalysesArray) {
                   const textContent = e.currentTarget.innerText.trim();
                   const newCellAnalyses = [...cellAnalysesArray];
                   const targetIdx = newCellAnalyses.findIndex((a: any) => a.cellIndex === index && (a.notebookIndex === undefined || a.notebookIndex === notebookIndex));
                   
                   if (targetIdx !== -1) {
                      newCellAnalyses[targetIdx] = { ...newCellAnalyses[targetIdx], explanation: textContent };
                      onAiDataChange({ ...aiData, cellAnalyses: newCellAnalyses });
                   } else if (textContent) {
                      newCellAnalyses.push({
                        cellIndex: index,
                        notebookIndex: notebookIndex,
                        explanation: textContent,
                        caption: 'Blok Kode',
                        section: chapterPrefix === 'II' ? 'implementasi' : 'post_test'
                      });
                      onAiDataChange({ ...aiData, cellAnalyses: newCellAnalyses });
                   }
                }
              }}
            >
              {(analysis && analysis.explanation) ? <MarkdownBlock content={analysis.explanation} /> : null}
            </div>

            {imageOutputs.map((out: any, oIdx: number) => {
              const base64Content = out.content.replace(/\s+/g, '');
              if (!base64Content) return null;
              return <PreviewImage key={oIdx} src={`data:image/png;base64,${base64Content}`} caption={`Gambar ${chapterPrefix}.${imgIdx++} ${tableCaption}`} />;
            })}
          </div>
        );
      }
      return null;
    }).filter(Boolean);

    return { elements, nextCodeIdx: codeIdx, nextImgIdx: imgIdx };
  };

  const implElements: React.ReactNode[] =[];
  let nextCodeIdxII = 1;
  let nextImgIdxII = 1;

  notebooks.forEach((nb, nbIdx) => {
    if (!nb) return;
    const sections = categorizeNotebookCells(nb, nbIdx, cellAnalysesArray ||[]);
    const implCells = nb.cells.map((c, i) => ({ cell: c, index: i, notebookIndex: nbIdx })).filter(item => sections[item.index] === 'implementasi');
    const res = renderNotebookCells(implCells, 'II', nextCodeIdxII, nextImgIdxII);
    implElements.push(...res.elements);
    nextCodeIdxII = res.nextCodeIdx;
    nextImgIdxII = res.nextImgIdx;
  });

  const usedImplImageIndexes = new Set<number>();
  cellAnalysesArray?.forEach((analysis: any, aiIdx: number) => {
    if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
      usedImplImageIndexes.add(analysis.imageIndex);
      const img = implImages[analysis.imageIndex];
      if (img && img.dataUrl) {
        implElements.push(
          <div key={`impl-img-${analysis.imageIndex}-${aiIdx}`} className="mb-8">
            <h3 className="font-bold mb-2">{(analysis.caption as string).replace(/['"]/g, '')}</h3>
            <PreviewImage src={img.dataUrl} caption={`Gambar II.${nextImgIdxII++} ${analysis.caption}`} />
            <div className="mt-4 prose prose-sm max-w-none text-gray-900 text-justify">
              <MarkdownBlock content={analysis.explanation} />
            </div>
          </div>
        );
      }
    }
  });

  const postTestElements: React.ReactNode[] =[];
  let nextCodeIdxIII = 1;
  let nextImgIdxIII = 1;

  notebooks.forEach((nb, nbIdx) => {
    if (!nb) return;
    const sections = categorizeNotebookCells(nb, nbIdx, cellAnalysesArray ||[]);
    const postTestCells = nb.cells.map((c, i) => ({ cell: c, index: i, notebookIndex: nbIdx })).filter(item => sections[item.index] === 'post_test');
    const res = renderNotebookCells(postTestCells, 'III', nextCodeIdxIII, nextImgIdxIII);
    postTestElements.push(...res.elements);
    nextCodeIdxIII = res.nextCodeIdx;
    nextImgIdxIII = res.nextImgIdx;
  });

  const usedPostTestImageIndexes = new Set<number>();
  cellAnalysesArray?.forEach((analysis: any, aiIdx: number) => {
    if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
      usedPostTestImageIndexes.add(analysis.imageIndex);
      const img = postTestImages[analysis.imageIndex];
      if (img && img.dataUrl) {
        postTestElements.push(
          <div key={`post-img-${analysis.imageIndex}-${aiIdx}`} className="mb-8">
            <h3 className="font-bold mb-2">{(analysis.caption as string).replace(/['"]/g, '')}</h3>
            <PreviewImage src={img.dataUrl} caption={`Gambar III.${nextImgIdxIII++} ${analysis.caption}`} />
            <div className="mt-4 prose prose-sm max-w-none text-gray-900 text-justify">
              <MarkdownBlock content={analysis.explanation} />
            </div>
          </div>
        );
      }
    }
  });

  if (Array.isArray(cAnalysis)) {
    cAnalysis.forEach(item => {
      if (item.imageIndex !== undefined) {
        usedImplImageIndexes.add(item.imageIndex);
      }
    });
  }

  const finalUnusedImplImages = implImages.filter((_, i) => !usedImplImageIndexes.has(i));
  const finalUnusedPostTestImages = postTestImages.filter((_, i) => !usedPostTestImageIndexes.has(i));

  const allImageMocks =[
    ...preTestImages.map((_, i) => `Gambar I.${i + 1} Lembar Jawaban Pre-Test`),
    ...finalUnusedImplImages.map((_, i) => `Gambar II.${nextImgIdxII + i} Output Visual / Screenshot`),
    ...finalUnusedPostTestImages.map((_, i) => `Gambar III.${nextImgIdxIII + i} Lembar Jawaban Post-Test`)
  ];
  const allCodeMocks = Array.from({ length: nextCodeIdxII - 1 }).map((_, i) => `Kode Program II.${i + 1} Blok Kode`);

  return (
    <div ref={previewRef} className="w-full flex flex-col items-center gap-8 py-8 font-sans text-black text-justify leading-relaxed outline-none">
      
      {/* 1. Cover Page */}
      <PreviewPage isCover>
        <div className="text-center w-full outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all text-black" contentEditable suppressContentEditableWarning>
          <h1 className="text-[18.6px] font-bold uppercase">{metadata.reportType === 'kuliah' ? 'LAPORAN KULIAH' : 'LAPORAN PRAKTIKUM'}</h1>
          <h2 className="text-[18.6px] font-bold mt-1 uppercase">{metadata.mataPraktikum || (metadata.reportType === 'kuliah' ? '[Mata Kuliah]' : '[Mata Praktikum]')}</h2>
          <h2 className="text-[18.6px] font-bold mt-1">{metadata.reportType === 'kuliah' ? 'Topik' : 'Materi'}</h2>
          <h2 className="text-[18.6px] font-bold mt-1 uppercase">{getFormattedJudulPertemuan(metadata)}</h2>
          <h2 className="text-[18.6px] font-bold mt-1">
            {metadata.laboratorium ? `${metadata.hariTanggalSesi} Lab. ${metadata.laboratorium}` : metadata.hariTanggalSesi || '[Hari/Tanggal/Sesi]'}
          </h2>
          
          <div className="my-[73px] flex justify-center" contentEditable={false}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-uad.png" alt="UAD Logo" className="w-[189px] h-[189px] object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
          </div>

          <div className="space-y-1">
            <h3 className="text-[16px] font-bold">Dosen Pengampu:</h3>
            <h3 className="text-[16px] mb-4">{metadata.dosen || '[Nama Dosen]'}</h3>
            <h3 className="text-[16px] font-bold">Disusun Oleh:</h3>
            <h3 className="text-[16px]">{metadata.nama || '[Nama Mahasiswa]'}</h3>
            <h3 className="text-[16px]">{metadata.nim || '[NIM]'}</h3>
          </div>
        </div>

        <div className="text-center w-full space-y-1 mb-8 outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all text-black" contentEditable suppressContentEditableWarning>
          <h3 className="text-[18.6px] font-bold">PROGRAM STUDI S1 INFORMATIKA</h3>
          <h3 className="text-[18.6px] font-bold">FAKULTAS TEKNOLOGI INDUSTRI</h3>
          <h3 className="text-[18.6px] font-bold">UNIVERSITAS AHMAD DAHLAN</h3>
          <h3 className="text-[18.6px] font-bold mt-4">{new Date().getFullYear()}</h3>
        </div>
      </PreviewPage>

      {/* 2. Daftar Isi */}
      <PreviewPage studentName={metadata.nama} pageNumber="I">
        <div className="text-left flex-1 relative outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-6 rounded transition-all" contentEditable suppressContentEditableWarning>
          <h1 className="text-xl font-bold text-center mb-12 font-serif uppercase text-black">Daftar Isi</h1>
          <div className="space-y-4 font-serif text-lg leading-relaxed text-black">
            <TocItem title="DAFTAR ISI" page="I" id="daftar-isi" isBold />
            <TocItem title="DAFTAR GAMBAR" page="II" id="daftar-gambar" isBold />
            <TocItem title="DAFTAR KODE PROGRAM" page="III" id="daftar-kode-program" isBold />

            {metadata.reportType === 'kuliah' ? (
              <>
                <TocItem title="BAB I PENDAHULUAN" page="1" id="pre-test" isBold />
                <TocItem title="BAB II PEMBAHASAN" page="2" id="hasil-praktikum" isBold />
                <TocItem title="BAB III KESIMPULAN" page="4" id="analisis-hasil" isBold />
              </>
            ) : (
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
        {metadata.reportType === 'kuliah' ? (
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
        ) : (
          <>
            <h1 id="pre-test" className="text-xl font-bold scroll-mt-8 outline-none text-black" contentEditable suppressContentEditableWarning>I. Pre Test</h1>
            <div className="pl-4 space-y-4">
              <QAList items={preTestAnswersArray} />
              
              {preTestImages.length > 0 && (
                <p className="mt-6 text-justify text-gray-900 text-sm">
                  Berikut adalah lampiran gambar lembar jawaban Pre-Test yang dikerjakan:
                </p>
              )}
              {preTestImages.map((img, idx) => (
                <PreviewImage key={img.id} src={img.dataUrl} caption={`Gambar I.${idx + 1} Lembar Jawaban Pre-Test`} />
              ))}
            </div>
          </>
        )}
      </PreviewPage>

      {/* 6. Hasil Praktikum (Alat & Langkah) / Pembahasan */}
      <PreviewPage studentName={metadata.nama} pageNumber="2">
        {metadata.reportType === 'kuliah' ? (
          <>
            <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB II<br/>PEMBAHASAN</h1>
            <NotebookLinks links={notebookLinks} />
          </>
        ) : (
          <>
            <h1 id="hasil-praktikum" className="text-xl font-bold scroll-mt-8 outline-none text-black" contentEditable suppressContentEditableWarning>II. Hasil Praktikum</h1>
            <div className="pl-4 space-y-6">
              <h2 id="alat-bahan" className="font-bold text-lg scroll-mt-8 text-black outline-none" contentEditable suppressContentEditableWarning>A. Alat dan Bahan:</h2>
              <div 
                className="pl-4 text-gray-900 text-justify outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all" 
                contentEditable suppressContentEditableWarning
                onBlur={(e) => {
                  if (onAiDataChange && aiData) {
                    const lines = e.currentTarget.innerText.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
                    onAiDataChange({ ...aiData, alatDanBahan: lines });
                  }
                }}
              >
                {aiData.alatDanBahan && aiData.alatDanBahan.length > 0 ? (
                  aiData.alatDanBahan.map((alat, idx) => <p key={idx}>{idx + 1}. {alat.replace(/^\d+\.\s*/, '')}</p>)
                ) : (
                  <>
                    <p>1. Komputer / Laptop</p>
                    <p>2. Google Colab / Jupyter Notebook / Software Terkait</p>
                  </>
                )}
              </div>

              <h2 id="langkah-kerja" className="font-bold text-lg mt-8 scroll-mt-8 text-black outline-none" contentEditable suppressContentEditableWarning>B. Langkah Kerja:</h2>
              <div 
                className="pl-4 prose prose-sm max-w-none text-gray-900 text-justify outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all" 
                contentEditable suppressContentEditableWarning
                onBlur={(e) => {
                  if (onAiDataChange && aiData) {
                    onAiDataChange({ ...aiData, stepByStepNarrative: e.currentTarget.innerText });
                  }
                }}
              >
                <MarkdownBlock content={narrative} />
              </div>
              <NotebookLinks links={notebookLinks} />
            </div>
          </>
        )}
      </PreviewPage>

      {/* 7. Chunking Implementasi / Code Blocks */}
      {Array.from({ length: Math.ceil(implElements.length / 2) }).map((_, chunkIdx) => {
        const chunkStart = chunkIdx * 2;
        const chunkElements = implElements.slice(chunkStart, chunkStart + 2);
        
        return (
          <PreviewPage key={`impl-chunk-${chunkIdx}`} studentName={metadata.nama} pageNumber={3 + chunkIdx}>
            {chunkIdx === 0 && metadata.reportType !== 'kuliah' && (
              <h2 id="implementasi" className="font-bold text-lg scroll-mt-8 text-black outline-none" contentEditable suppressContentEditableWarning>C. Implementasi/Screenshot:</h2>
            )}
            <div className="pl-4 space-y-8">
              {chunkElements}
            </div>
          </PreviewPage>
        );
      })}

      {/* 8. Analisis Hasil & Impl Images Terakhir */}
      <PreviewPage studentName={metadata.nama} pageNumber={3 + Math.ceil(implElements.length / 2)}>
        <div className="pl-4 space-y-6">
          <div className="space-y-8">
            {finalUnusedImplImages.map((img, idx) => (
              <PreviewImage key={img.id} src={img.dataUrl} caption={`Gambar II.${nextImgIdxII + idx} Output Visual / Screenshot`} />
            ))}
          </div>

          {metadata.reportType === 'kuliah' ? (
            <h1 id="analisis-hasil" className="text-xl font-bold scroll-mt-8 outline-none text-black text-center" contentEditable suppressContentEditableWarning>BAB III<br/>KESIMPULAN</h1>
          ) : (
            <h2 id="analisis-hasil" className="font-bold text-lg mt-8 scroll-mt-8 text-black outline-none" contentEditable suppressContentEditableWarning>D. Analisis Hasil:</h2>
          )}
          {Array.isArray(cAnalysis) ? (
            <div className={`${metadata.reportType === 'kuliah' ? 'mt-8 ' : 'pl-4 '}space-y-6 text-gray-900 text-justify outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all`}>
              {cAnalysis.map((item, idx) => {
                const img = item.imageIndex !== undefined ? implImages[item.imageIndex] : null;
                const chapterPrefix = metadata.reportType === 'kuliah' ? 'III' : 'II';
                return (
                  <div key={idx} className="space-y-4">
                    {img && (
                      <div className="mb-4">
                        {item.caption && <h3 className="font-bold mb-2">{item.caption.replace(/['"]/g, '')}</h3>}
                        <PreviewImage src={img.dataUrl} caption={`Gambar ${chapterPrefix}.\${nextImgIdxII++} ${item.caption || 'Output Visual'}`} />
                      </div>
                    )}
                    {item.teks && (
                      <div className="prose prose-sm max-w-none text-gray-900 text-justify">
                        <MarkdownBlock content={item.teks} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div 
              className={`${metadata.reportType === 'kuliah' ? 'mt-8 ' : 'pl-4 '}prose prose-sm max-w-none text-gray-900 text-justify outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all`} 
              contentEditable suppressContentEditableWarning
              onBlur={(e) => {
                if (onAiDataChange && aiData) {
                  onAiDataChange({ ...aiData, codeAnalysis: e.currentTarget.innerText });
                }
              }}
            >
              <MarkdownBlock content={typeof cAnalysis === 'string' ? cAnalysis : ''} />
            </div>
          )}

          {metadata.reportType !== 'kuliah' && (
            <div className="mt-8">
              <h2 id="ulasan-praktikum" className="font-bold text-lg scroll-mt-8 text-black outline-none" contentEditable suppressContentEditableWarning>E. Ulasan Praktikum:</h2>
              <div 
                className="pl-4 mt-4 prose prose-sm max-w-none text-gray-900 text-justify outline-none border border-transparent focus:border-gray-300 focus:bg-gray-50 p-2 rounded transition-all"
                contentEditable suppressContentEditableWarning
                onBlur={(e) => {
                  if (onAiDataChange && aiData) {
                    onAiDataChange({ ...aiData, ulasanPraktikum: e.currentTarget.innerText });
                  }
                }}
              >
                <MarkdownBlock content={aiData?.ulasanPraktikum || 'Silakan tulis ulasan praktikum Anda di sini...'} />
              </div>
            </div>
          )}
        </div>
      </PreviewPage>

      {/* 9. Post Test */}
      {metadata.reportType !== 'kuliah' && (
        <PreviewPage studentName={metadata.nama} pageNumber={4 + Math.ceil(implElements.length / 2)}>
          <h1 id="post-test" className="text-xl font-bold scroll-mt-8 outline-none text-black" contentEditable suppressContentEditableWarning>III. Post Test</h1>
          <div className="pl-4 space-y-6">
            <QAList items={postTestAnswersArray} />
            <NotebookLinks links={postTestNotebookLinks} title="Link Notebook Post-Test:" />

            {postTestElements.length > 0 && (
              <p className="mt-8 text-justify text-gray-900 text-sm">Berikut adalah hasil dan analisis implementasi program yang dikerjakan pada sesi Post-Test:</p>
            )}
            {postTestElements}

            {finalUnusedPostTestImages.length > 0 && (
              <p className="mt-8 text-justify text-gray-900 text-sm">Berikut adalah lampiran gambar lembar jawaban Post-Test yang dikerjakan:</p>
            )}
            {finalUnusedPostTestImages.map((img, idx) => (
              <PreviewImage key={img.id} src={img.dataUrl} caption={`Gambar III.${nextImgIdxIII + idx} Lembar Jawaban Post-Test`} />
            ))}
          </div>
        </PreviewPage>
      )}
    </div>
  );
}


/**
 * Memoized export. The inner component is heavy (lots of markdown parsing,
 * KaTeX rendering, iterating notebook cells), and the host `session-tab`
 * triggers a re-render on every metadata keystroke even when the preview
 * inputs are unchanged. The shallow check below short-circuits those
 * unrelated renders. (R8 #1.)
 */
export const ReportPreview = React.memo(ReportPreviewInner, (prev, next) => {
  // Shallow-compare the rendering-relevant fields only. `onAiDataChange`
  // and `onMetadataChange` are passed as fresh closures from the parent
  // and are intentionally excluded — a parent re-render with a fresh
  // callback should not force a preview re-render.
  if (prev.aiData !== next.aiData) return false;
  if (prev.notebooks !== next.notebooks) return false;
  if (prev.modulContext !== next.modulContext) return false;
  if (prev.postTest !== next.postTest) return false;
  if (prev.preTestImages !== next.preTestImages) return false;
  if (prev.implImages !== next.implImages) return false;
  if (prev.postTestImages !== next.postTestImages) return false;
  // Metadata is compared by the visible identity fields; other fields
  // (laboratorium etc.) are folded into the cover page and rendered
  // through these.
  const m1 = prev.metadata;
  const m2 = next.metadata;
  return (
    m1.nama === m2.nama &&
    m1.nim === m2.nim &&
    m1.judulPertemuan === m2.judulPertemuan &&
    m1.mataPraktikum === m2.mataPraktikum &&
    m1.hariTanggalSesi === m2.hariTanggalSesi &&
    m1.laboratorium === m2.laboratorium &&
    m1.dosen === m2.dosen &&
    m1.pertemuan === m2.pertemuan &&
    m1.reportType === m2.reportType
  );
});
