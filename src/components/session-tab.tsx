'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseNotebook, ParsedNotebook } from '@/lib/parser';
import type { ReportMetadata, AIReportData, UserImage } from '@/lib/types';
import { getFormattedJudulPertemuan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ReportPreview } from '@/components/report-preview';
import { SettingsPanel } from '@/components/settings-panel';
import { CopilotPanel } from '@/components/copilot-panel';
import { useAppStore, ReportSession } from '@/lib/store';
import { Save, X, FileText } from 'lucide-react';
import { AVAILABLE_MODELS } from '@/lib/ai-schema';
import { useCopilotAI } from '@/hooks/use-copilot-ai';
import { useResizableSidebar } from '@/hooks/use-resizable-sidebar';
import { useSessionAutosave } from '@/hooks/use-session-autosave';
import { useReportDownload } from '@/hooks/use-report-download';
import { useScheduleAutofill } from '@/hooks/use-schedule-autofill';
import { useColabFetcher, seedColabCacheFromSession } from '@/hooks/use-colab-fetcher';
import { cn } from '@/lib/utils';

import { createPortal } from 'react-dom';

export function SessionTab({ sessionId }: { sessionId: string }) {
  const store = useAppStore();
  const session = store.sessions.find(s => s.id === sessionId);
  
  const [metadata, setMetadata] = useState<ReportMetadata>({
    mataPraktikum: session?.metadata.mataPraktikum || '',
    judulPertemuan: session?.metadata.judulPertemuan || '',
    hariTanggalSesi: session?.metadata.hariTanggalSesi || '',
    laboratorium: session?.metadata.laboratorium || '',
    dosen: session?.metadata.dosen || '',
    pertemuan: session?.metadata.pertemuan || 1,
    reportType: session?.metadata.reportType || 'praktikum',
    nama: store.profile.nama,
    nim: store.profile.nim,
  });

  const [preTest, setPreTest] = useState(session?.preTest || '');
  const [preTestImages, setPreTestImages] = useState<UserImage[]>([]);
  
  const [modulContext, setModulContext] = useState(session?.modulContext || '');
  
  const [postTest, setPostTest] = useState(session?.postTest || '');
  const [postTestImages, setPostTestImages] = useState<UserImage[]>([]);

  const [ulasanPraktikum, setUlasanPraktikum] = useState(session?.ulasanPraktikum || '');
  const [notebookFiles, setNotebookFiles] = useState<File[]>([]);
  const [parsedNotebooks, setParsedNotebooks] = useState<ParsedNotebook[]>([]);
  const [postTestNotebookFiles, setPostTestNotebookFiles] = useState<File[]>([]);
  const [postTestParsedNotebooks, setPostTestParsedNotebooks] = useState<ParsedNotebook[]>([]);
  const [implImages, setImplImages] = useState<UserImage[]>([]);

  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'settings'>('settings');

  const [generatedDocxBlob, setGeneratedDocxBlob] = useState<Blob | null>(null);
  const [aiPreviewData, setAiPreviewData] = useState<AIReportData | null>(session?.aiData || null);
  const [newMk, setNewMk] = useState('');
  const [isAddingMk, setIsAddingMk] = useState(false);

  const [chatInput, setChatInput] = useState('');

  // Setup Resizable Sidebar Logic
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: sidebarWidth, isDragging, dragHandleProps } = useResizableSidebar();

  // Stable callbacks for the memoized ReportPreview (R8 #1).
  const handlePreviewAiDataChange = useCallback((newData: AIReportData) => {
    setAiPreviewData(newData);
    setGeneratedDocxBlob(null);
  }, []);
  const handlePreviewMetadataChange = useCallback((newMeta: ReportMetadata) => {
    setMetadata(newMeta);
    setGeneratedDocxBlob(null);
  }, []);

  const { download, prefetchDocxChunk } = useReportDownload({
    metadata,
    aiPreviewData,
    generatedDocxBlob,
    setGeneratedDocxBlob,
    parsedNotebooks,
    postTestParsedNotebooks,
    preTestImages,
    implImages,
    postTestImages,
    modulContext,
    postTest,
  });

  // Prefetch the docx chunk on idle once a preview becomes available so
  // the first Download click stays instant (R7 prefetch + R8 #5 fix).
  useEffect(() => {
    if (aiPreviewData) prefetchDocxChunk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!aiPreviewData]);

  const {
    isGenerating,
    progress,
    statusText,
    chatHistory,
    setChatHistory,
    selectedModelName,
    setSelectedModelName,
    generateReport: generateReportAI,
    compileEdit: compileEditAI,
    runState,
    iteration,
    maxLoops,
    currentTool,
    retryStatus,
    taskPlan,
    pause,
    stop,
    continueRun,
    saveManualCheckpoint,
    checkpoints,
    revertToCheckpointById,
    pendingMerge,
    acceptHunk,
    rejectHunk,
    acceptAllHunks,
    rejectAllHunks,
    submitClarification,
    pendingClarification,
    clearChat,
    undoToMessage,
    chatThreads,
    openThread,
    deleteThread,
  } = useCopilotAI(session);

  // Load Saved Session Data and Populate Cache
  useEffect(() => {
    if (session) {
      if (session.files && session.files.length > 0 && parsedNotebooks.length === 0) {
          const loadedParsed: ParsedNotebook[] = [];
          const loadedFiles: File[] = [];
          session.files.forEach(f => {
             if (!f.content || f.content.trim() === '') return;
             try {
               const parsed = parseNotebook(f.content, f.name);
               loadedParsed.push(parsed);
               const fileObj = new File([f.content], f.name, { type: 'text/plain' });
               loadedFiles.push(fileObj);
             } catch (e) {}
          });
          // Restore the Colab download cache so tab switches don't re-fetch.
          seedColabCacheFromSession(session.files, loadedParsed);
          setParsedNotebooks(loadedParsed);
          if (notebookFiles.length === 0) setNotebookFiles(loadedFiles);
      }
      
      const loadImages = async () => {
         if (session.preTestImages && preTestImages.length === 0) setPreTestImages(session.preTestImages.map(img => ({ id: img.id, dataUrl: img.dataUrl || (img as any).fileData })));
         if (session.implImages && implImages.length === 0) setImplImages(session.implImages.map(img => ({ id: img.id, dataUrl: img.dataUrl || (img as any).fileData })));
         if (session.postTestImages && postTestImages.length === 0) setPostTestImages(session.postTestImages.map(img => ({ id: img.id, dataUrl: img.dataUrl || (img as any).fileData })));
      };
      loadImages();
    }
  }, [session?.id]);

  useSessionAutosave(session, metadata);

  useColabFetcher({
    modulContext,
    postTest,
    autoFetchColab: store.autoFetchColab,
    onImplAdd: useCallback((file, parsed) => {
      setNotebookFiles((prev) => {
        if (prev.some((f) => f.name === file.name || f.size === file.size)) return prev;
        setParsedNotebooks((p) => [...p.filter(n => n.name !== file.name), { ...parsed, name: file.name }]);
        return [...prev, file];
      });
    }, []),
    onPostTestAdd: useCallback((file, parsed) => {
      setPostTestNotebookFiles((prev) => {
        if (prev.some((f) => f.name === file.name || f.size === file.size)) return prev;
        setPostTestParsedNotebooks((p) => [...p.filter(n => n.name !== file.name), { ...parsed, name: file.name }]);
        return [...prev, file];
      });
    }, []),
  });

  const saveCurrentSession = async () => {
    if (!session) return;
    store.setProfile({ nama: metadata.nama, nim: metadata.nim });
    const savedFiles = await Promise.all(notebookFiles.map(async (f) => ({ name: f.name, content: await f.text() })));

    store.saveSession({
      ...session,
      metadata: { ...metadata },
      preTest, modulContext, postTest, ulasanPraktikum,
      files: savedFiles,
      preTestImages: preTestImages.map(img => ({id: img.id, dataUrl: img.dataUrl})),
      implImages: implImages.map(img => ({id: img.id, dataUrl: img.dataUrl})),
      postTestImages: postTestImages.map(img => ({id: img.id, dataUrl: img.dataUrl})),
      aiData: aiPreviewData
    });
    toast.success('Session saved successfully!');
  };

  const handlePasteToUploader = useCallback(async (e: React.ClipboardEvent, setter: React.Dispatch<React.SetStateAction<UserImage[]>>) => {
    const items = e.clipboardData.items;
    const pendingImages: Promise<UserImage>[] = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('pdf') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
                pendingImages.push(new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve({ id: Math.random().toString(36).substring(7), dataUrl: event.target?.result as string });
                    reader.readAsDataURL(file);
                }));
            }
        }
    }
    if (pendingImages.length > 0) {
        const results = await Promise.all(pendingImages);
        setter(prev => [...prev, ...results]);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = parseNotebook(e.target?.result as string, file.name);
          setNotebookFiles(prev => {
            if (prev.some(f => f.name === file.name || f.size === file.size)) return prev;
            setParsedNotebooks(p => [...p.filter(n => n.name !== file.name), { ...parsed, name: file.name }]);
            return [...prev, file];
          });
          setGeneratedDocxBlob(null);
          toast.success(`File Uploaded: ${file.name}`);
        } catch (err) { toast.error("Invalid file"); }
      };
      reader.readAsText(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, maxFiles: 10 });

  const onDropPostTest = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = parseNotebook(e.target?.result as string, file.name);
          setPostTestNotebookFiles(prev => {
             if (prev.some(f => f.name === file.name || f.size === file.size)) return prev;
             setPostTestParsedNotebooks(p => [...p.filter(n => n.name !== file.name), { ...parsed, name: file.name }]);
             return [...prev, file];
          });
          setGeneratedDocxBlob(null);
          toast.success(`Post-Test File Uploaded: ${file.name}`);
        } catch (err) { toast.error("Invalid file"); }
      };
      reader.readAsText(file);
    });
  }, []);

  const { getRootProps: getRootPropsPt, getInputProps: getInputPropsPt, isDragActive: isDragActivePt } = useDropzone({ onDrop: onDropPostTest, maxFiles: 5 });

  const handleCreateNewMataPraktikum = () => {
    if (newMk.trim()) {
      store.addMataPraktikum(newMk);
      setMetadata({ ...metadata, mataPraktikum: newMk });
      setNewMk('');
      setIsAddingMk(false);
    }
  };

  const { onMataPraktikumChange: handleMataPraktikumChange, onPertemuanChange: handlePertemuanChange, onSaveCustomDate: handleSaveCustomDate } = useScheduleAutofill({
    metadata,
    setMetadata,
    modulContext,
    setModulContext,
    setPreTest,
    setPostTest,
    session,
  });

  const handleGenerate = async () => {
    if (!metadata.nama || !metadata.nim || !metadata.mataPraktikum) {
      toast.error('Please fill in the required metadata fields (Nama, NIM, Mata Praktikum).');
      return;
    }
    saveCurrentSession();
    await generateReportAI({
      metadata, setMetadata, preTest, preTestImages, modulContext, postTest, postTestImages, implImages, ulasanPraktikum,
      parsedNotebooks, notebookFiles, postTestParsedNotebooks, postTestNotebookFiles,
      session, store, setAiPreviewData, setGeneratedDocxBlob
    });
  };

  const handleDownload = download;

  const handleCompileEdit = async () => {
    await compileEditAI({
      chatInput, setChatInput, aiPreviewData, setAiPreviewData, metadata, setMetadata, parsedNotebooks, postTestParsedNotebooks,
      preTestImages, implImages, postTestImages, modulContext, postTest, setGeneratedDocxBlob, session, store
    });
  };

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('sidebar-portal-target'));
  }, [store.isCopilotOpen]);

  const sidebarContent = store.isCopilotOpen ? (
    <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Header Panel */}
        <div className="h-9 shrink-0 flex items-center justify-between pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A]">
          <div className="flex h-full">
            <button 
              onClick={() => setActiveSidebarTab('chat')} 
              className={`relative h-9 px-3 text-[12px] font-medium transition-colors ${activeSidebarTab === 'chat' ? 'text-[#EDEDED]' : 'text-[#6E6E6E] hover:text-[#A1A1A1]'}`}
            >
              Copilot
              {activeSidebarTab === 'chat' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2F81F7]" />
              )}
            </button>
            <button 
              onClick={() => setActiveSidebarTab('settings')} 
              className={`relative h-9 px-3 text-[12px] font-medium transition-colors ${activeSidebarTab === 'settings' ? 'text-[#EDEDED]' : 'text-[#6E6E6E] hover:text-[#A1A1A1]'}`}
            >
              Setup
              {activeSidebarTab === 'settings' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2F81F7]" />
              )}
            </button>
          </div>
          <button 
            onClick={() => store.toggleCopilot()} 
            className="w-7 h-7 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] rounded-sm"
            title="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        
        {/* Content Panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeSidebarTab === 'chat' && (
            <CopilotPanel 
              chatHistory={chatHistory} isGenerating={isGenerating} statusText={statusText}
              selectedModelName={selectedModelName} setSelectedModelName={setSelectedModelName} availableModels={AVAILABLE_MODELS}
              handleGenerate={handleGenerate} aiPreviewData={aiPreviewData} chatInput={chatInput} setChatInput={setChatInput} handleCompileEdit={handleCompileEdit}
              sessionTitle={session?.title || getFormattedJudulPertemuan(metadata, aiPreviewData) || metadata.mataPraktikum || 'New chat'}
              onNewChat={clearChat}
              onClose={() => store.toggleCopilot()}
              runState={runState} iteration={iteration} maxLoops={maxLoops}
              currentTool={currentTool} retryStatus={retryStatus} taskPlan={taskPlan}
              pause={pause} stop={stop} continueRun={continueRun}
              saveManualCheckpoint={saveManualCheckpoint}
              checkpoints={checkpoints} revertToCheckpointById={revertToCheckpointById}
              undoToMessage={undoToMessage}
              chatThreads={chatThreads}
              onOpenThread={openThread}
              onDeleteThread={deleteThread}
              pendingMerge={pendingMerge}
              acceptHunk={acceptHunk} rejectHunk={rejectHunk}
              acceptAllHunks={acceptAllHunks} rejectAllHunks={rejectAllHunks}
              pendingClarification={pendingClarification}
              submitClarification={submitClarification}
            />
          )}

          {activeSidebarTab === 'settings' && (
            <SettingsPanel 
              metadata={metadata} setMetadata={setMetadata} store={store}
              isAddingMk={isAddingMk} setIsAddingMk={setIsAddingMk} newMk={newMk} setNewMk={setNewMk}
              handleCreateNewMataPraktikum={handleCreateNewMataPraktikum} handleMataPraktikumChange={handleMataPraktikumChange} handlePertemuanChange={handlePertemuanChange}
              getRootProps={getRootProps} getInputProps={getInputProps} isDragActive={isDragActive} notebookFiles={notebookFiles} setNotebookFiles={setNotebookFiles} parsedNotebooks={parsedNotebooks} setParsedNotebooks={setParsedNotebooks} setGeneratedDocxBlob={setGeneratedDocxBlob}
              preTest={preTest} setPreTest={setPreTest} handlePasteToUploader={handlePasteToUploader} preTestImages={preTestImages} setPreTestImages={setPreTestImages}
              modulContext={modulContext} setModulContext={setModulContext} implImages={implImages} setImplImages={setImplImages}
              postTest={postTest} setPostTest={setPostTest} postTestImages={postTestImages} setPostTestImages={setPostTestImages}
              ulasanPraktikum={ulasanPraktikum} setUlasanPraktikum={setUlasanPraktikum}
              getRootPropsPt={getRootPropsPt} getInputPropsPt={getInputPropsPt} isDragActivePt={isDragActivePt} postTestNotebookFiles={postTestNotebookFiles} setPostTestNotebookFiles={setPostTestNotebookFiles} postTestParsedNotebooks={postTestParsedNotebooks} setPostTestParsedNotebooks={setPostTestParsedNotebooks}
              saveCurrentSession={saveCurrentSession} handleSaveCustomDate={handleSaveCustomDate} handleGenerate={handleGenerate} aiPreviewData={aiPreviewData} isGenerating={isGenerating}
            />
          )}
        </div>
    </div>
  ) : null;

    useEffect(() => {
    const handleExport = () => download();
    window.addEventListener('export-docx', handleExport);
    return () => window.removeEventListener('export-docx', handleExport);
  }, [download]);

  return (
    <div ref={containerRef} className="flex w-full h-full min-h-0 bg-[#0A0A0A] text-sm overflow-hidden flex-row">
       
       {/* Left side: Center Document Canvas */}
       <div className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-8 flex flex-col items-center custom-scrollbar pb-32">
           {aiPreviewData ? (
               <div className="w-full relative mx-auto flex justify-center">
                  <ReportPreview 
                     metadata={metadata} 
                     aiData={aiPreviewData} 
                     notebooks={parsedNotebooks} 
                     modulContext={modulContext}
                     preTestImages={preTestImages}
                     implImages={implImages}
                     postTestImages={postTestImages}
                     onAiDataChange={handlePreviewAiDataChange}
                     onMetadataChange={handlePreviewMetadataChange}
                  />
                  <Button 
                    onClick={handleDownload} 
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#2F81F7] hover:bg-[#2563EB] text-white rounded-sm py-3 px-5 gap-2 transition-colors z-40 font-medium text-[12px] tracking-wide uppercase border border-[#1F3A66] h-10"
                  >
                    <Save className="w-4 h-4" /> {generatedDocxBlob ? 'Download .docx' : 'Download'}
                  </Button>
               </div>
           ) : (
               <div className="flex flex-col items-center justify-center h-full text-[#6E6E6E] w-full max-w-md mt-20">
                  <div className="w-14 h-14 bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center mb-5 rounded-sm">
                    <FileText className="w-6 h-6 text-[#4A4A4A]" />
                  </div>
                  <h2 className="text-[16px] font-semibold text-[#EDEDED]">Start your report</h2>
                  <p className="text-center mt-2 text-[13px] text-[#A1A1A1] leading-relaxed max-w-sm">
                    Open the <span className="text-[#EDEDED] font-medium">Setup</span> tab on the right to fill in your report details, then ask Copilot to generate the document.
                  </p>
                  <button 
                    onClick={() => { store.toggleCopilot(); setActiveSidebarTab('settings'); }} 
                    className="mt-5 h-9 px-4 bg-[#2F81F7] hover:bg-[#2563EB] text-white text-[12px] font-medium transition-colors rounded-sm"
                  >
                     Open setup panel
                  </button>
               </div>
           )}
       </div>

       {/* Render Sidebar via Portal */}
       {store.isCopilotOpen && portalTarget
         ? createPortal(sidebarContent, portalTarget)
         : null}
    </div>
  );
}
