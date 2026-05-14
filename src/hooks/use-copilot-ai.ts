import { useState } from 'react';
import { Content, Part } from '@google/genai';
import { toast } from 'sonner';
import type { AIReportData, UserImage, ReportMetadata } from '@/lib/types';
import { ParsedNotebook } from '@/lib/parser';
import {
  AVAILABLE_MODELS,
  generateReportDeclaration,
  generateKuliahReportDeclaration,
  runAgentLoop,
  buildGenerationPrompt,
  buildEditPrompt,
  buildBatchContinuationMessage,
  GENERATION_SYSTEM_INSTRUCTION,
  EDIT_SYSTEM_INSTRUCTION,
  type CopilotMessage,
  type ToolCallState,
  type AgentLoopCallbacks,
} from '@/lib/ai';

export type { CopilotMessage, ToolCallState };

const EMPTY_AI_DATA: AIReportData = {
  preTestAnswers: [],
  postTestAnswers: [],
  alatDanBahan: [],
  stepByStepNarrative: '',
  codeAnalysis: '',
  cellAnalyses: [],
  pendahuluan: '',
};

export function useCopilotAI() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>([
    {
      role: 'agent',
      text:
        'Halo! Saya AI Report Generator Copilot. Silakan isi data praktikum di tab "Settings", lalu klik "Generate" atau perintahkan saya untuk membuat maupun mengedit laporan!',
    },
  ]);

  const [selectedModelName, setSelectedModelName] = useState(AVAILABLE_MODELS[1].name);

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
    setGeneratedDocxBlob: (blob: Blob | null) => void,
  ) => {
    let logoBlob: Blob | null = null;
    try {
      const res = await fetch('/logo-uad.png');
      if (res.ok) logoBlob = await res.blob();
    } catch (e) {
      console.warn('Gagal memuat logo:', e);
    }

    // Dynamic import keeps `docx` out of the initial chunk.
    const { generateDocx } = await import('@/lib/docx');
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
      numImplNotebooks,
    );
    setGeneratedDocxBlob(docxBlob);
  };

  /**
   * Build the React-state-bridging callbacks expected by `runAgentLoop`.
   * Each iteration creates a placeholder agent message via `onIterationStart`
   * and then incrementally patches it as text/thoughts/tools stream in.
   */
  const makeAgentCallbacks = (
    setAiPreviewData: (data: AIReportData) => void,
  ): AgentLoopCallbacks & { activeMsgId: string } => {
    const handle = { activeMsgId: '' };

    return Object.assign(handle, {
      onStatus: (s: string) => setStatusText(s),

      onIterationStart: (_loop: number) => {
        const id = crypto.randomUUID();
        handle.activeMsgId = id;
        setChatHistory((prev) => [
          ...prev,
          { role: 'agent', text: '', isThinking: true, id, tools: [] },
        ]);
        return id;
      },

      onText: (text: string) => {
        const id = handle.activeMsgId;
        setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, text } : m)));
      },

      onThought: (thought: string) => {
        const id = handle.activeMsgId;
        setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, thought } : m)));
      },

      onToolUpdate: (tools: ToolCallState[]) => {
        const id = handle.activeMsgId;
        setChatHistory((prev) => prev.map((m) => (m.id === id ? { ...m, tools } : m)));
      },

      onPreviewMerge: setAiPreviewData,

      onMergeComplete: (next: AIReportData) => {
        setAiPreviewData(next);
      },

      onIterationEnd: (msgId: string, finalTools: ToolCallState[]) => {
        setChatHistory((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, isThinking: false, tools: finalTools } : m,
          ),
        );
      },

      onSystemMessage: (text: string) => {
        setChatHistory((prev) => [...prev, { role: 'system', text }]);
      },
    });
  };

  const generateReport = async ({
    metadata,
    preTest,
    preTestImages,
    modulContext,
    postTest,
    postTestImages,
    implImages,
    parsedNotebooks,
    notebookFiles,
    postTestParsedNotebooks,
    postTestNotebookFiles,
    session,
    store,
    setAiPreviewData,
    setGeneratedDocxBlob,
  }: any) => {
    try {
      const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
      if (!apiKeyToUse) {
        toast.error(
          'API Key Gemini belum diatur. Silakan tambahkan di pengaturan Word Options.',
        );
        return;
      }

      setIsGenerating(true);
      setProgress(10);
      setStatusText('Mempersiapkan data file & melabeli index gambar...');
      setGeneratedDocxBlob(null);

      let notebookPromptData = 'No notebook provided. Rely on images and context.';
      const combinedParsedNotebooks = [...parsedNotebooks, ...postTestParsedNotebooks];

      const notebookImagesToAppend: { nbIdx: number; cellIdx: number; base64: string }[] = [];

      if (combinedParsedNotebooks.length > 0) {
        setStatusText('Mengekstrak visual output dari Notebook...');
        const allCells: any[] = [];
        let imageCounter = 0;

        combinedParsedNotebooks.forEach((nb, nbIdx) => {
          if (!nb) return;
          nb.cells.forEach((c: any, idx: number) => {
            const textOutputs = c.outputs
              ?.filter((o: any) => o.type === 'text')
              .map((o: any) => ({ type: 'text', content: o.content }));

            const imageOutputs = c.outputs?.filter((o: any) => o.type === 'image');
            if (imageOutputs && imageOutputs.length > 0) {
              textOutputs?.push({
                type: 'system_note',
                content: `[VISUAL OUTPUT GENERATED: Sel ini menghasilkan ${imageOutputs.length} gambar/grafik/plot. AI WAJIB membaca dan mendeskripsikan secara mendalam grafik ini (tren, angka korelasi, makna) di dalam kolom 'explanation'.]`,
              });
              imageOutputs.forEach((imgOut: any) =>
                notebookImagesToAppend.push({ nbIdx, cellIdx: idx, base64: imgOut.content }),
              );
            }

            let cleanSource = c.source;
            if (cleanSource) {
              const regex = /!\[(.*?)\]\((data:image\/(.*?);base64,(.*?))\)/g;
              cleanSource = cleanSource.replace(regex, (_match: string, alt: string) => {
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
              notebookFileName:
                nbIdx < parsedNotebooks.length
                  ? notebookFiles[nbIdx]?.name
                  : postTestNotebookFiles[nbIdx - parsedNotebooks.length]?.name,
              cellIndex: idx,
              type: c.cell_type,
              source: cleanSource,
              outputs: textOutputs,
            });
          });
        });
        notebookPromptData = JSON.stringify(allCells);
      }

      const totalImages =
        preTestImages.length + implImages.length + postTestImages.length + notebookImagesToAppend.length;
      const isKuliah = metadata.reportType === 'kuliah';

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'user',
          text: `Tolong analisa data praktikum ini secara teliti dan persiapkan laporan beserta dokumen docx-nya. Terdapat total ${totalImages} lampiran visual.`,
        },
      ]);

      setProgress(30);
      setStatusText('Menganalisis prompt dan konteks praktikum...');

      const prompt = buildGenerationPrompt({
        isKuliah,
        totalImages,
        judulLaporan: session?.metadata?.judulPertemuan || '',
        mataPraktikum: session?.metadata?.mataPraktikum || '',
        preTest,
        modulContext,
        postTest,
        notebookPromptData,
      });

      const initialParts: Part[] = [{ text: prompt } as Part];

      const addImagesToContent = (imgs: UserImage[], category: string) => {
        if (imgs.length === 0) return;
        initialParts.push({ text: `\n--- [KATEGORI UPLOAD: ${category}] ---` } as Part);
        imgs.forEach((img, idx) => {
          const parts = img.dataUrl.split(',');
          const match = parts[0].match(/:(.*?);/);
          const mimeType = match ? match[1] : 'image/jpeg';
          const base64Data = parts[1];
          if (base64Data && mimeType) {
            initialParts.push({
              text: `\n[Gambar Kategori: ${category}] -> Gunakan nilai ini untuk mapping: [Relative Index: ${idx}]`,
            } as Part);
            initialParts.push({ inlineData: { data: base64Data, mimeType } } as Part);
          }
        });
      };

      addImagesToContent(preTestImages, 'pre_test');
      addImagesToContent(implImages, 'implementasi');
      addImagesToContent(postTestImages, 'post_test');

      if (notebookImagesToAppend.length > 0) {
        initialParts.push({
          text: `\n--- [NOTEBOOK VISUAL OUTPUTS (Charts/Graphs/Plots)] ---`,
        } as Part);
        notebookImagesToAppend.forEach((img) => {
          initialParts.push({
            text: `Grafik/Gambar Output dari Notebook Index ${img.nbIdx}, Cell Index ${img.cellIdx}:`,
          } as Part);
          initialParts.push({
            inlineData: { data: img.base64.replace(/\s+/g, ''), mimeType: 'image/png' },
          } as Part);
        });
      }

      const contentsHistory: Content[] = [{ role: 'user', parts: initialParts }];
      const selectedModelId =
        AVAILABLE_MODELS.find((m) => m.name === selectedModelName)?.id || 'gemini-3.1-pro-preview';
      const activeDeclaration = isKuliah
        ? generateKuliahReportDeclaration
        : generateReportDeclaration;

      const callbacks = makeAgentCallbacks(setAiPreviewData);

      const accumulatedAiData = await runAgentLoop({
        apiKey: apiKeyToUse,
        modelId: selectedModelId,
        contents: contentsHistory,
        systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
        declaration: activeDeclaration,
        maxLoops: 15,
        sysMsgBuilder: (loop) => buildBatchContinuationMessage(loop, totalImages),
        mode: 'append',
        initial: EMPTY_AI_DATA,
        callbacks,
      });

      setProgress(70);
      setStatusText('Menulis dan merapikan dokumen DOCX...');

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'agent',
          text: 'Laporan berhasil di-generate secara struktural dan file DOCX telah dipersiapkan! (Agen berhasil mengekstrak seluruh visualisasi dan mengurutkannya secara mandiri).',
        },
      ]);

      toast.success('Laporan berhasil di-generate!');
      setProgress(80);

      await buildAndSetDocx(
        metadata,
        combinedParsedNotebooks,
        accumulatedAiData,
        preTestImages,
        implImages,
        postTestImages,
        modulContext,
        postTest,
        parsedNotebooks.length,
        setGeneratedDocxBlob,
      );

      setProgress(100);
      setStatusText('Selesai!');

      if (session) {
        store.saveSession({
          ...session,
          title: metadata.judulPertemuan,
          aiData: accumulatedAiData,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal men-generate: ' + error.message);
      setChatHistory((prev) => [
        ...prev,
        { role: 'agent', text: 'Error eksekusi: ' + error.message },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const compileEdit = async ({
    chatInput,
    setChatInput,
    aiPreviewData,
    setAiPreviewData,
    metadata,
    parsedNotebooks,
    postTestParsedNotebooks,
    preTestImages,
    implImages,
    postTestImages,
    modulContext,
    postTest,
    setGeneratedDocxBlob,
    session,
    store,
  }: any) => {
    if (!chatInput.trim() || !aiPreviewData) return;

    const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
    if (!apiKeyToUse) {
      toast.error('API Key Gemini belum diatur. Silakan tambahkan di pengaturan Word Options.');
      return;
    }

    const userMessage = chatInput;
    setChatInput('');
    setChatHistory((prev) => [...prev, { role: 'user', text: userMessage }]);

    setIsGenerating(true);
    setStatusText('Menganalisis permintaan instruksi edit...');

    try {
      const prompt = buildEditPrompt({
        judulLaporan: session?.metadata?.judulPertemuan || '',
        currentDataJson: JSON.stringify(aiPreviewData, null, 2),
        userMessage,
      });

      const selectedModelId =
        AVAILABLE_MODELS.find((m) => m.name === selectedModelName)?.id || 'gemini-3.1-pro-preview';
      const activeDeclaration =
        session && session.metadata?.reportType === 'kuliah'
          ? generateKuliahReportDeclaration
          : generateReportDeclaration;
      const contentsHistory: Content[] = [
        { role: 'user', parts: [{ text: prompt } as Part] },
      ];

      const callbacks = makeAgentCallbacks(setAiPreviewData);

      const accumulatedAiData = await runAgentLoop({
        apiKey: apiKeyToUse,
        modelId: selectedModelId,
        contents: contentsHistory,
        systemInstruction: EDIT_SYSTEM_INSTRUCTION,
        declaration: activeDeclaration,
        maxLoops: 3,
        sysMsgBuilder: () =>
          'If you are done editing, reply with text. Otherwise, keep calling.',
        mode: 'replace',
        initial: aiPreviewData,
        callbacks,
      });

      setStatusText('Menulis dan merapikan dokumen DOCX...');
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'agent',
          text: 'Struktur laporan telah berhasil diperbarui sesuai dengan instruksi yang diberikan.',
        },
      ]);

      const combinedParsedNotebooks = [...parsedNotebooks, ...postTestParsedNotebooks];

      await buildAndSetDocx(
        metadata,
        combinedParsedNotebooks,
        accumulatedAiData,
        preTestImages,
        implImages,
        postTestImages,
        modulContext,
        postTest,
        parsedNotebooks.length,
        setGeneratedDocxBlob,
      );

      setStatusText('Selesai!');

      if (session) {
        store.saveSession({
          ...session,
          title: metadata.judulPertemuan,
          aiData: accumulatedAiData,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Gagal mengedit: ' + error.message);
      setChatHistory((prev) => [
        ...prev,
        { role: 'agent', text: 'Error eksekusi: ' + error.message },
      ]);
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
