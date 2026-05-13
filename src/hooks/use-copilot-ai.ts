import { useState } from 'react';
import { GoogleGenAI, FunctionCallingConfigMode, Part, Content } from '@google/genai';
import { toast } from 'sonner';
import { generateDocx, AIReportData, UserImage, ReportMetadata } from '@/lib/docxBuilder';
import { ParsedNotebook } from '@/lib/parser';
import { AVAILABLE_MODELS, generateReportDeclaration, generateKuliahReportDeclaration } from '@/lib/ai-schema';
import { buildTempAiReportData, mergeAiReportData } from '@/lib/ai-utils';

export interface ToolCallState {
  name: string;
  status: 'running' | 'completed';
  args?: any;
}

export interface CopilotMessage {
  role: 'user' | 'agent' | 'system';
  text: string;
  isThinking?: boolean;
  thought?: string;
  tools?: ToolCallState[];
  id?: string;
}

export function useCopilotAI() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>([
    { role: 'agent', text: 'Halo! Saya AI Report Generator Copilot. Silakan isi data praktikum di tab "Settings", lalu klik "Generate" atau perintahkan saya untuk membuat maupun mengedit laporan!' }
  ]);

  const [selectedModelName, setSelectedModelName] = useState(AVAILABLE_MODELS[1].name);

  // Helper untuk generate DOCX secara efisien
  const buildAndSetDocx = async (
    metadata: ReportMetadata,
    combinedParsedNotebooks: ParsedNotebook[],
    accumulatedAiData: AIReportData,
    preTestImages: UserImage[],
    implImages: UserImage[],
    postTestImages: UserImage[],
    modulContext: string,
    postTest: string,
    numImplNotebooks: number,
    setGeneratedDocxBlob: (blob: Blob | null) => void
  ) => {
    let logoBlob: Blob | null = null;
    try {
      const res = await fetch('/logo-uad.png');
      if (res.ok) logoBlob = await res.blob();
    } catch (e) {
      console.warn('Gagal memuat logo:', e);
    }

    const docxBlob = await generateDocx(
      metadata, 
      combinedParsedNotebooks, 
      accumulatedAiData, 
      logoBlob, 
      preTestImages, 
      implImages, 
      postTestImages,
      modulContext,
      postTest,
      numImplNotebooks
    );
    setGeneratedDocxBlob(docxBlob);
  };

  const executeAgenticLoop = async (
    apiKey: string,
    selectedModelId: string,
    contentsHistory: Content[],
    systemInstruction: string,
    activeDeclaration: any,
    maxLoops: number,
    sysMsgTextBuilder: (loopCount: number) => string,
    initialAiData: AIReportData,
    setAiPreviewData: (data: AIReportData) => void,
    isEditMode: boolean = false
  ): Promise<AIReportData> => {
    let isDone = false;
    let loopCount = 0;
    let accumulatedAiData = { ...initialAiData };

    while (!isDone && loopCount < maxLoops) {
      loopCount++;
      setStatusText(loopCount === 1 ? 'Memeriksa dan mengatur urutan gambar (Cognitive Sorting)...' : `Melanjutkan ekstraksi data (Batch ${loopCount})...`);
      
      const currentAgentMsgId = crypto.randomUUID();
      setChatHistory(prev => [
        ...prev, 
        { role: 'agent', text: "", isThinking: true, id: currentAgentMsgId, tools: [] }
      ]);

      const ai = new GoogleGenAI({ apiKey });
      const stream = await ai.models.generateContentStream({
        model: selectedModelId,
        contents: contentsHistory as Part[], 
        config: {
          systemInstruction,
          temperature: 0.2,
          thinkingConfig: { includeThoughts: true },
          tools: [{ functionDeclarations: [activeDeclaration] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } }
        },
      });

      let functionCallName = '';
      let thoughtString = '';
      let textString = '';
      let functionCallRawArgs: any = null;
      let functionCallId = '';
      let thoughtSignature = '';
      let activeTools: ToolCallState[] = [];

      for await (const chunk of stream) {
        let hasChanges = false;

        if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
                const ts = (part as any).thoughtSignature || (part as any).thought_signature;
                if (ts) thoughtSignature = ts;

                if (part.thought) {
                    thoughtString += part.text || '';
                    hasChanges = true;
                } else if (part.text) {
                    textString += part.text;
                    hasChanges = true;
                } else if (part.functionCall) {
                    functionCallName = part.functionCall.name || '';
                    functionCallRawArgs = part.functionCall.args;
                    functionCallId = part.functionCall.id || functionCallId;
                    
                    const existingTool = activeTools.find(t => t.name === functionCallName);
                    if (!existingTool) {
                        activeTools.push({ name: functionCallName, status: 'running', args: functionCallRawArgs });
                        hasChanges = true;
                    } else if (JSON.stringify(existingTool.args) !== JSON.stringify(functionCallRawArgs)) {
                        existingTool.args = functionCallRawArgs; 
                        hasChanges = true;
                    }
                }
            }
        }
        
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            functionCallName = chunk.functionCalls[0].name || functionCallName;
            functionCallRawArgs = chunk.functionCalls[0].args || functionCallRawArgs;
            functionCallId = chunk.functionCalls[0].id || functionCallId;
            
            const existingTool = activeTools.find(t => t.name === functionCallName);
            if (!existingTool) {
                activeTools.push({ name: functionCallName, status: 'running', args: functionCallRawArgs });
                hasChanges = true;
            } else if (JSON.stringify(existingTool.args) !== JSON.stringify(functionCallRawArgs)) {
                existingTool.args = functionCallRawArgs; 
                hasChanges = true;
            }
        }

        if (hasChanges) {
           setChatHistory(prev => prev.map(h => h.id === currentAgentMsgId ? { ...h, text: textString, thought: thoughtString, tools: [...activeTools] } : h));
        }

        if (functionCallName === 'generate_report' && functionCallRawArgs) {
           try {
              const tempData = isEditMode ? mergeAiReportData(accumulatedAiData, functionCallRawArgs, true) : buildTempAiReportData(accumulatedAiData, functionCallRawArgs);
              setAiPreviewData(tempData);
           } catch(e) {}
        }
      } 

      setChatHistory(prev => prev.map(h => h.id === currentAgentMsgId ? { ...h, isThinking: false } : h));

      const modelParts: any[] = [];
      if (textString) modelParts.push({ text: textString });
      
      if (functionCallRawArgs && functionCallName) {
          const fcPart: any = {
              functionCall: { name: functionCallName, args: functionCallRawArgs, id: functionCallId }
          };
          if (thoughtSignature) {
              fcPart.thoughtSignature = thoughtSignature;
              fcPart.thought_signature = thoughtSignature;
          }
          modelParts.push(fcPart);
      }

      if (modelParts.length > 0) {
          contentsHistory.push({ role: 'model', parts: modelParts as Part[] });
      } else if (thoughtString) {
          contentsHistory.push({ role: 'model', parts: [{ text: '' }] as Part[] });
      }

      if (functionCallName === 'generate_report' && functionCallRawArgs) {
          accumulatedAiData = mergeAiReportData(accumulatedAiData, functionCallRawArgs, isEditMode);
          setAiPreviewData(accumulatedAiData);

          setChatHistory(prev => prev.map(h => h.id === currentAgentMsgId ? { ...h, tools: h.tools?.map(t => t.name === functionCallName ? { ...t, status: 'completed' } : t) } : h));

          const sysMsgText = sysMsgTextBuilder(loopCount);

          setChatHistory(prev => [
              ...prev,
              { role: 'system', text: sysMsgText }
          ]);

          contentsHistory.push({
              role: 'user',
              parts: [{
                  functionResponse: {
                      name: functionCallName,
                      id: functionCallId,
                      response: { status: "success", message: sysMsgText }
                  }
              } as any]
          });
          
      } else {
          isDone = true;
      }
    } 

    return accumulatedAiData;
  };

  const generateReport = async ({
    metadata, preTest, preTestImages, modulContext, postTest, postTestImages, implImages,
    parsedNotebooks, notebookFiles, postTestParsedNotebooks, postTestNotebookFiles, session, store,
    setAiPreviewData, setGeneratedDocxBlob
  }: any) => {
    try {
      const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
      if (!apiKeyToUse) {
        toast.error('API Key Gemini belum diatur. Silakan tambahkan di pengaturan Word Options.');
        return;
      }

      setIsGenerating(true);
      setProgress(10);
      setStatusText('Mempersiapkan data file & melabeli index gambar...');
      setGeneratedDocxBlob(null);

      let notebookPromptData = 'No notebook provided. Rely on images and context.';
      const combinedParsedNotebooks = [...parsedNotebooks, ...postTestParsedNotebooks];
      
      const notebookImagesToAppend: { nbIdx: number, cellIdx: number, base64: string }[] = [];

      if (combinedParsedNotebooks.length > 0) {
        setStatusText('Mengekstrak visual output dari Notebook...');
        const allCells: any[] = [];
        let imageCounter = 0;
        
        combinedParsedNotebooks.forEach((nb, nbIdx) => {
          if (!nb) return;
          nb.cells.forEach((c: any, idx: number) => {
            const textOutputs = c.outputs?.filter((o: any) => o.type === 'text').map((o: any) => ({ type: 'text', content: o.content }));

            const imageOutputs = c.outputs?.filter((o: any) => o.type === 'image');
            if (imageOutputs && imageOutputs.length > 0) {
               textOutputs?.push({ 
                 type: 'system_note', 
                 content: `[VISUAL OUTPUT GENERATED: Sel ini menghasilkan ${imageOutputs.length} gambar/grafik/plot. AI WAJIB membaca dan mendeskripsikan secara mendalam grafik ini (tren, angka korelasi, makna) di dalam kolom 'explanation'.]` 
               });
               imageOutputs.forEach((imgOut: any) => notebookImagesToAppend.push({ nbIdx, cellIdx: idx, base64: imgOut.content }));
            }

            let cleanSource = c.source;
            if (cleanSource) {
              const regex = /!\[(.*?)\]\((data:image\/(.*?);base64,(.*?))\)/g;
              cleanSource = cleanSource.replace(regex, (match: string, alt: string) => {
                imageCounter++;
                return `[Image Omitted: ${alt || `Notebook_Image_${imageCounter}`}]`;
              });
              const htmlRegex = /<img[^>]+src=["'](data:image\/[^;]+;base64,[^"']+)["'][^>]*>/gi;
              cleanSource = cleanSource.replace(htmlRegex, () => {
                imageCounter++;
                return `[Image Omitted: HTML_Image_${imageCounter}]`;
              });
            }

            allCells.push({ 
              notebookIndex: nbIdx, 
              notebookFileName: nbIdx < parsedNotebooks.length ? notebookFiles[nbIdx]?.name : postTestNotebookFiles[nbIdx - parsedNotebooks.length]?.name,
              cellIndex: idx, type: c.cell_type, source: cleanSource, outputs: textOutputs 
            });
          });
        });
        notebookPromptData = JSON.stringify(allCells);
      }

      const totalImages = preTestImages.length + implImages.length + postTestImages.length + notebookImagesToAppend.length;
      const isKuliah = metadata.reportType === 'kuliah';

      setChatHistory(prev => [
        ...prev, 
        { role: 'user', text: `Tolong analisa data praktikum ini secara teliti dan persiapkan laporan beserta dokumen docx-nya. Terdapat total ${totalImages} lampiran visual.` }
      ]);

      setProgress(30);
      setStatusText('Menganalisis prompt dan konteks praktikum...');

      const prompt = `
        Anda adalah Agen AI Otonom layaknya ahli/analis data manusia yang menyusun laporan formal.
        ${isKuliah ? 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field \`pendahuluan\` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.' : 'Ini adalah format LAPORAN PRAKTIKUM.'}
        
        CRITICAL INSTRUCTIONS & COGNITIVE REARRANGEMENT:
        1. Anda akan menerima puluhan gambar yang mungkin diupload TIDAK BERURUTAN (misal: soal Post-Test ada di akhir, atau Gambar Visualisasi 3 diupload sebelum Visualisasi 1).
        2. TUGAS ANDA:
           - Deteksi konteks tiap gambar secara visual (baca teks di dalam gambar seperti "Studi Kasus", "Visualisasi 1", "Langkah 2").
           - Pisahkan mana yang merupakan SOAL TEKS, mana yang merupakan HASIL IMPLEMENTASI (Screenshot Program/Grafik).
           - Jika gambar adalah Soal (misal teks Notepad/Soal PDF): Ekstrak teks pertanyaannya secara lengkap ke dalam field \`questions\` (baik di \`pre_test\` maupun \`post_test\` sesuai kategorinya). JANGAN masukkan gambar soal ke \`cellAnalyses\`.
           - Jika gambar adalah Hasil Implementasi/Jawaban: Masukkan ke dalam \`cellAnalyses\`, pastikan Anda memberikan deskripsi detail/analisis tajam di \`explanation\`.
        3. RELATIVE IMAGE INDEXING (PENTING!):
           Setiap gambar yang dilampirkan akan diberi label seperti "[Relative Index: 0]", "[Relative Index: 1]", dst sesuai kategori uploadnya. 
           Anda WAJIB mengisi field \`imageIndex\` pada \`cellAnalyses\` menggunakan angka dari "[Relative Index: X]" tersebut secara tepat agar dokumen tidak salah meletakkan gambar!
        4. CHRONOLOGICAL SORTING: Susun array \`cellAnalyses\` secara KRONOLOGIS dari awal hingga akhir (misal: Visualisasi 1 harus di array atas, Visualisasi 2 di bawahnya, dsb), meskipun urutan upload dari user berantakan!
        5. "Langkah Kerja" (stepByStepNarrative) wajib menggunakan format Markdown yang rapi.
        6. Tone: Gunakan KALIMAT PASIF formal secara dominan ("Dataset dibaca menggunakan...", bukan "Saya membaca...").
        7. DILARANG KERAS menggunakan teks template/generic seperti "Implementasi Kode" atau "Tabel/Output DataFrame". Berikan penamaan caption (caption & tableCaption) yang SANGAT SPESIFIK dan DINAMIS untuk setiap baris kode/gambar (misal: "Proses Cleansing Data Missing Values", "Tabel Distribusi Kategori Produk"). Setiap sel kode HARUS memiliki \`caption\`! DILARANG MENGOSONGKANNYA!

        MULTI-TURN BATCH PROCESSING (CRITICAL):
        TOTAL GAMBAR/VISUAL YANG DIKIRIMKAN ADALAH: ${totalImages} gambar.
        Untuk menghindari token output terpotong, jalankan metode Agentic Loop:
        - Panggil \`generate_report\` untuk menyimpan sebagian data (misal 4-8 gambar pertama).
        - Sistem akan membalas pesan "success".
        - Panggil lagi \`generate_report\` HANYA untuk melanjutkan sisa gambar/data yang BELUM terekstrak di panggilan sebelumnya.
        - Sistem otomatis melakukan *append* (penggabungan) pada array \`cellAnalyses\`. JANGAN mengirim ulang data gambar yang sudah dianalisis di batch sebelumnya untuk menghindari duplikasi!
        - Jika SEMUA ${totalImages} gambar sudah terekstrak dengan benar, tuliskan teks biasa ("Laporan selesai") dan STOP memanggil fungsi \`generate_report\`.

        Context Tambahan:
        Judul Laporan: ${session?.metadata?.judulPertemuan || '-'}
        Mata Praktikum / Kuliah: ${session?.metadata?.mataPraktikum || '-'}
        Pre-Test Questions: ${preTest}
        Modul Context/Goals: ${modulContext}
        Post-Test Questions: ${postTest}

        Notebook Data (JSON Extracted Cells):
        ${notebookPromptData}
      `;

      const initialParts: any[] = [{ text: prompt }];

      const addImagesToContent = (imgs: UserImage[], category: string) => {
        if (imgs.length > 0) {
           initialParts.push({ text: `\n--- [KATEGORI UPLOAD: ${category}] ---` });
           imgs.forEach((img, idx) => {
             const parts = img.dataUrl.split(',');
             const match = parts[0].match(/:(.*?);/);
             const mimeType = match ? match[1] : 'image/jpeg';
             const base64Data = parts[1];
             if (base64Data && mimeType) {
                initialParts.push({ text: `\n[Gambar Kategori: ${category}] -> Gunakan nilai ini untuk mapping: [Relative Index: ${idx}]` });
                initialParts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
             }
           });
        }
      };

      addImagesToContent(preTestImages, "pre_test");
      addImagesToContent(implImages, "implementasi");
      addImagesToContent(postTestImages, "post_test");

      if (notebookImagesToAppend.length > 0) {
          initialParts.push({ text: `\n--- [NOTEBOOK VISUAL OUTPUTS (Charts/Graphs/Plots)] ---` });
          notebookImagesToAppend.forEach(img => {
              initialParts.push({ text: `Grafik/Gambar Output dari Notebook Index ${img.nbIdx}, Cell Index ${img.cellIdx}:` });
              initialParts.push({ inlineData: { data: img.base64.replace(/\s+/g, ''), mimeType: 'image/png' } });
          });
      }

      const contentsHistory: Content[] = [{ role: 'user', parts: initialParts as Part[] }];
      const selectedModelId = AVAILABLE_MODELS.find(m => m.name === selectedModelName)?.id || 'gemini-3.1-pro-preview';
      const activeDeclaration = isKuliah ? generateKuliahReportDeclaration : generateReportDeclaration;
      
      const emptyData: AIReportData = { preTestAnswers: [], postTestAnswers: [], alatDanBahan: [], stepByStepNarrative: '', codeAnalysis: '', cellAnalyses: [], pendahuluan: '' };

      const accumulatedAiData = await executeAgenticLoop(
        apiKeyToUse, selectedModelId, contentsHistory,
        'You act as an autonomous AI analyst. Read images, sort them chronologically, extract text from questions, and map visualizations correctly using relative indexes in multi-turn batches.',
        activeDeclaration,
        15,
        (loop) => `Tugas batch ${loop} berhasil diproses. Sistem telah menggabungkan array \`cellAnalyses\` dan \`questions\`. Lanjutkan analisis ke sisa gambar yang belum diekstrak. Jangan mengulang data yang sama. Jika semua ${totalImages} gambar sudah diproses, balas dengan teks penutup dan berhenti memanggil fungsi.`,
        emptyData,
        setAiPreviewData,
        false
      );

      setProgress(70);
      setStatusText('Menulis dan merapikan dokumen DOCX...');

      setChatHistory(prev => [
        ...prev, 
        { role: 'agent', text: "Laporan berhasil di-generate secara struktural dan file DOCX telah dipersiapkan! (Agen berhasil mengekstrak seluruh visualisasi dan mengurutkannya secara mandiri)." }
      ]);

      toast.success('Laporan berhasil di-generate!');
      setProgress(80);

      await buildAndSetDocx(
        metadata, combinedParsedNotebooks, accumulatedAiData, preTestImages, implImages, postTestImages, modulContext, postTest, parsedNotebooks.length, setGeneratedDocxBlob
      );
      
      setProgress(100);
      setStatusText('Selesai!');
      
      if (session) {
         store.saveSession({ ...session, title: metadata.judulPertemuan, aiData: accumulatedAiData });
      }

    } catch (error: any) {
      console.error(error);
      toast.error('Gagal men-generate: ' + error.message);
      setChatHistory(prev => [...prev, { role: 'agent', text: 'Error eksekusi: ' + error.message }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const compileEdit = async ({
    chatInput, setChatInput, aiPreviewData, setAiPreviewData, metadata, parsedNotebooks, postTestParsedNotebooks,
    preTestImages, implImages, postTestImages, modulContext, postTest, setGeneratedDocxBlob, session, store
  }: any) => {
    if (!chatInput.trim() || !aiPreviewData) return;
    
    const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
    if (!apiKeyToUse) {
      toast.error('API Key Gemini belum diatur. Silakan tambahkan di pengaturan Word Options.');
      return;
    }

    const userMessage = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMessage }]);
    
    setIsGenerating(true);
    setStatusText('Menganalisis permintaan instruksi edit...');

    try {
      const prompt = `You are an AI Markdown Editor. 
The user is requesting you to edit the structured lab report data.
Judul Laporan / Topik Kajian: ${session?.metadata?.judulPertemuan || '-'}

Current Data:
${JSON.stringify(aiPreviewData, null, 2)}

User Request: "${userMessage}"

You MUST output the new, updated structured data using the \`generate_report\` tool that satisfies the user's request. Modify ONLY what they asked. Keep the rest of the layout and properties intact.`;

      const selectedModelId = AVAILABLE_MODELS.find(m => m.name === selectedModelName)?.id || 'gemini-3.1-pro-preview';
      const activeDeclaration = session && session.metadata?.reportType === 'kuliah' ? generateKuliahReportDeclaration : generateReportDeclaration;
      const contentsHistory: Content[] = [{ role: 'user', parts: [{ text: prompt }] as Part[] }];

      const accumulatedAiData = await executeAgenticLoop(
        apiKeyToUse, selectedModelId, contentsHistory,
        'You act as an editor that modifies data based on user input.',
        activeDeclaration,
        3,
        () => "If you are done editing, reply with text. Otherwise, keep calling.",
        aiPreviewData,
        setAiPreviewData,
        true
      );

      setStatusText('Menulis dan merapikan dokumen DOCX...');
      setChatHistory(prev => [
        ...prev, 
        { role: 'agent', text: 'Struktur laporan telah berhasil diperbarui sesuai dengan instruksi yang diberikan.' }
      ]);
      
      const combinedParsedNotebooks = [...parsedNotebooks, ...postTestParsedNotebooks];
      
      await buildAndSetDocx(
        metadata, combinedParsedNotebooks, accumulatedAiData, preTestImages, implImages, postTestImages, modulContext, postTest, parsedNotebooks.length, setGeneratedDocxBlob
      );
      
      setStatusText('Selesai!');
      
      if (session) {
         store.saveSession({ ...session, title: metadata.judulPertemuan, aiData: accumulatedAiData });
      }

    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengedit: ' + error.message);
      setChatHistory(prev => [...prev, { role: 'agent', text: 'Error eksekusi: ' + error.message }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    progress,
    statusText,
    chatHistory,
    setChatHistory,
    selectedModelName,
    setSelectedModelName,
    generateReport,
    compileEdit,
  };
}