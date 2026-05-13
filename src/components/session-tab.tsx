'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { saveAs } from 'file-saver';
import { parseNotebook, ParsedNotebook } from '@/lib/parser';
import { generateDocx, ReportMetadata, AIReportData, UserImage } from '@/lib/docxBuilder';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ReportPreview } from '@/components/report-preview';
import { SettingsPanel } from '@/components/settings-panel';
import { CopilotPanel } from '@/components/copilot-panel';
import { useAppStore, ReportSession } from '@/lib/store';
import { Save, X, FileText } from 'lucide-react';
import { AVAILABLE_MODELS } from '@/lib/ai-schema';
import { useCopilotAI } from '@/hooks/use-copilot-ai';

// Global Caches to prevent re-downloading across tab switches and component remounts
const colabCache = new Map<string, { text: string; parsed: ParsedNotebook }>();
const ongoingFetches = new Map<string, Promise<void>>();
const failedLinks = new Set<string>();

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
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const {
    isGenerating,
    progress,
    statusText,
    chatHistory,
    setChatHistory,
    selectedModelName,
    setSelectedModelName,
    generateReport: generateReportAI,
    compileEdit: compileEditAI
  } = useCopilotAI();

  // Load Saved Session Data and Populate Cache
  useEffect(() => {
    if (session) {
      if (session.files && session.files.length > 0 && parsedNotebooks.length === 0) {
          const loadedParsed: ParsedNotebook[] = [];
          const loadedFiles: File[] = [];
          session.files.forEach(f => {
             if (!f.content || f.content.trim() === '') return;
             try {
               const parsed = parseNotebook(f.content);
               loadedParsed.push(parsed);
               const fileObj = new File([f.content], f.name, { type: 'application/x-ipynb+json' });
               loadedFiles.push(fileObj);
               
               // Restore to global cache so tab switches don't trigger redownloads
               const match = f.name.match(/colab_([a-zA-Z0-9_-]+)\.ipynb/);
               if (match) {
                 const fileId = match[1];
                 const standardLink = `https://colab.research.google.com/drive/${fileId}`;
                 if (!colabCache.has(standardLink)) {
                    colabCache.set(standardLink, { text: f.content, parsed });
                 }
               }
             } catch (e) {}
          });
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

  useEffect(() => {
    if (!session) return;
    const timeout = setTimeout(() => {
      store.saveSession({ ...session, metadata: { ...metadata } });
    }, 500);
    return () => clearTimeout(timeout);
  }, [metadata]);

  // Robust Colab Fetching Engine
  useEffect(() => {
    const fetchNotebookFromLink = async (link: string, isPostTest: boolean) => {
      const match = link.match(/colab\.research\.google\.com\/drive\/([a-zA-Z0-9_-]+)/);
      if (!match) return;
      const fileId = match[1];
      const fileName = `colab_${fileId}.ipynb`;

      // Prevent spamming failed links
      if (failedLinks.has(link)) return;

      // 1. Instant Cache Hit (Strict deduplication by file name)
      if (colabCache.has(link)) {
        const cached = colabCache.get(link)!;
        const file = new File([cached.text], fileName, { type: 'application/x-ipynb+json' });
        
        if (isPostTest) {
          setPostTestNotebookFiles(prev => {
            if (prev.some(f => f.name === fileName)) return prev;
            setPostTestParsedNotebooks(p => [...p, cached.parsed]);
            return [...prev, file];
          });
        } else {
          setNotebookFiles(prev => {
            if (prev.some(f => f.name === fileName)) return prev;
            setParsedNotebooks(p => [...p, cached.parsed]);
            return [...prev, file];
          });
        }
        return;
      }

      // 2. Wait for ongoing fetches to prevent race conditions
      if (ongoingFetches.has(link)) {
        await ongoingFetches.get(link);
        if (colabCache.has(link)) {
          fetchNotebookFromLink(link, isPostTest); // Re-trigger to hit cache above
        }
        return;
      }

      // 3. Initiate fetch with Proxy Fallbacks
      const fetchPromise = (async () => {
        const loadingToastId = toast.loading(`Mengunduh Colab: ${fileId.substring(0, 8)}...`);
        try {
          const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
          
          // Reordered for best success rates handling Google Drive redirects
          const proxies = [
            `https://corsproxy.io/?url=${encodeURIComponent(downloadUrl)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(downloadUrl)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(downloadUrl)}`
          ];

          let text = '';
          let parsed: ParsedNotebook | null = null;

          for (const proxy of proxies) {
            try {
              const response = await fetch(proxy);
              if (response.ok) {
                const resText = await response.text();
                try {
                  parsed = parseNotebook(resText);
                  text = resText;
                  break; // Found working proxy, break loop
                } catch (parseError) {
                  console.warn(`Proxy ${proxy} returned non-JSON data.`);
                }
              }
            } catch (fetchError) {
              console.warn(`Proxy ${proxy} fetch failed.`);
            }
          }

          if (!parsed || !text) {
             throw new Error('Semua proxy gagal atau file tidak dibagikan publik. (Ubah akses ke "Anyone with the link").');
          }
          
          colabCache.set(link, { text, parsed });
          toast.success(`Berhasil mengunduh Colab`, { id: loadingToastId });
        } catch (error: any) {
          console.error('Colab download error:', error);
          failedLinks.add(link);
          toast.error(`Gagal mengunduh Colab: ${error.message}`, { id: loadingToastId });
        } finally {
          ongoingFetches.delete(link);
        }
      })();

      ongoingFetches.set(link, fetchPromise);
      await fetchPromise;
      
      if (colabCache.has(link)) {
        fetchNotebookFromLink(link, isPostTest);
      }
    };

    const linkRegex = /https:\/\/colab\.research\.google\.com\/drive\/[a-zA-Z0-9_-]+/g;
    
    const modulLinks = modulContext.match(linkRegex) || [];
    modulLinks.forEach(link => fetchNotebookFromLink(link, false));
    
    const ptLinks = postTest.match(linkRegex) || [];
    ptLinks.forEach(link => fetchNotebookFromLink(link, true));

  }, [modulContext, postTest]);

  const saveCurrentSession = async () => {
    if (!session) return;
    store.setProfile({ nama: metadata.nama, nim: metadata.nim });
    const savedFiles = await Promise.all(notebookFiles.map(async (f) => ({ name: f.name, content: await f.text() })));

    store.saveSession({
      ...session,
      metadata: { ...metadata },
      preTest, modulContext, postTest,
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
          const parsed = parseNotebook(e.target?.result as string);
          setNotebookFiles(prev => {
            if (prev.some(f => f.name === file.name)) return prev;
            setParsedNotebooks(p => [...p, parsed]);
            return [...prev, file];
          });
          setGeneratedDocxBlob(null);
          toast.success(`Notebook Uploaded: ${file.name}`);
        } catch (err) { toast.error("Invalid notebook file"); }
      };
      reader.readAsText(file);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/x-ipynb+json': ['.ipynb'] }, maxFiles: 10 });

  const onDropPostTest = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = parseNotebook(e.target?.result as string);
          setPostTestNotebookFiles(prev => {
             if (prev.some(f => f.name === file.name)) return prev;
             setPostTestParsedNotebooks(p => [...p, parsed]);
             return [...prev, file];
          });
          setGeneratedDocxBlob(null);
          toast.success(`Post-Test Notebook Uploaded: ${file.name}`);
        } catch (err) { toast.error("Invalid notebook file"); }
      };
      reader.readAsText(file);
    });
  }, []);

  const { getRootProps: getRootPropsPt, getInputProps: getInputPropsPt, isDragActive: isDragActivePt } = useDropzone({ onDrop: onDropPostTest, accept: { 'application/x-ipynb+json': ['.ipynb'] }, maxFiles: 5 });

  const handleCreateNewMataPraktikum = () => {
    if (newMk.trim()) {
      store.addMataPraktikum(newMk);
      setMetadata({ ...metadata, mataPraktikum: newMk });
      setNewMk('');
      setIsAddingMk(false);
    }
  };

  const calculateSessionDate = (pertemuanNum: number, schedule: any) => {
    if (!schedule) return metadata.hariTanggalSesi;
    if (schedule.customDates && schedule.customDates[pertemuanNum]) return schedule.customDates[pertemuanNum];
    
    let currentDate = new Date('2026-04-13T00:00:00');
    const HARI_MAP: Record<string, number> = { 'minggu': 0, 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6 };
    const targetHaris = (schedule.hari || '').toLowerCase().split(/[,&/]|dan/).map((s: string) => HARI_MAP[s.trim()]).filter((h: number | undefined) => h !== undefined);
    if (targetHaris.length === 0) targetHaris.push(1);

    const advanceToNextTargetDay = (date: Date) => {
      date.setDate(date.getDate() + 1);
      while (!targetHaris.includes(date.getDay())) date.setDate(date.getDate() + 1);
    };

    while (!targetHaris.includes(currentDate.getDay())) currentDate.setDate(currentDate.getDate() + 1);

    const parseIndonesianDate = (dateStr: string): Date | null => {
      const months: Record<string, number> = { 'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5, 'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11 };
      const match = dateStr.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = months[match[2].toLowerCase()];
        const year = parseInt(match[3], 10);
        if (month !== undefined) return new Date(year, month, day);
      }
      return null;
    };

    for (let i = 1; i < pertemuanNum; i++) {
      if (schedule.customDates && schedule.customDates[i]) {
        const parsed = parseIndonesianDate(schedule.customDates[i]);
        if (parsed) currentDate = parsed;
      }
      advanceToNextTargetDay(currentDate);
    }
    
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}, ${schedule.jamMulai || '00:00'} - ${schedule.jamSelesai || '00:00'}`;
  };

  const handleMataPraktikumChange = (v: string | null) => {
    if (!v) return;
    if (v.startsWith('sch:')) {
      const id = v.replace('sch:', '');
      const schedule = store.schedules.find(s => s.id === id);
      if (schedule) {
        const p = metadata.pertemuan || 1;
        let newJudul = metadata.judulPertemuan;
        let newModulContext = modulContext;
        
        if (schedule.moduleData && schedule.moduleData[p]) {
          const modData = schedule.moduleData[p];
          newJudul = modData.judul || newJudul;
          
          let compiledContext = '';
          if (modData.config?.includeLangkah !== false) {
             compiledContext = modData.langkah || '';
          }
          newModulContext = compiledContext || newModulContext;
          
          if (modData.config?.includePreTest && modData.pre_test) {
             setPreTest(modData.pre_test);
             session.preTest = modData.pre_test;
          }
          if (modData.config?.includePostTest && modData.post_test) {
             setPostTest(modData.post_test);
             session.postTest = modData.post_test;
          }
          
          toast.success(`Data modul pertemuan ${p} otomatis terisi!`);
        }

        setMetadata({
          ...metadata,
          mataPraktikum: schedule.mataPraktikum,
          hariTanggalSesi: calculateSessionDate(p, schedule),
          laboratorium: schedule.laboratorium,
          dosen: schedule.dosen,
          judulPertemuan: newJudul,
        });
        setModulContext(newModulContext);
        toast.success(`Jadwal "${schedule.mataPraktikum}" terpilih! Sesi diatur otomatis.`);
        return;
      }
    }
    setMetadata({...metadata, mataPraktikum: v || ''});
  };

  const handlePertemuanChange = (p: number) => {
    const schedule = store.schedules.find(s => s.mataPraktikum === metadata.mataPraktikum);
    if (schedule) {
      let newJudul = metadata.judulPertemuan;
      let newModulContext = modulContext;
      
      if (schedule.moduleData && schedule.moduleData[p]) {
        const modData = schedule.moduleData[p];
        newJudul = modData.judul || newJudul;
        
        let compiledContext = '';
        if (modData.config?.includeLangkah !== false) {
           compiledContext = modData.langkah || '';
        }
        newModulContext = compiledContext || newModulContext;
        
        if (modData.config?.includePreTest && modData.pre_test) {
           setPreTest(modData.pre_test);
           if (session) session.preTest = modData.pre_test;
        }
        if (modData.config?.includePostTest && modData.post_test) {
           setPostTest(modData.post_test);
           if (session) session.postTest = modData.post_test;
        }
        
        toast.success(`Data modul pertemuan ${p} otomatis terisi!`);
      }

      setMetadata({ 
        ...metadata, 
        pertemuan: p, 
        hariTanggalSesi: calculateSessionDate(p, schedule),
        judulPertemuan: newJudul
      });
      setModulContext(newModulContext);
    } else {
      setMetadata({ ...metadata, pertemuan: p });
    }
  };

  const handleSaveCustomDate = () => {
    const schedule = store.schedules.find(s => s.mataPraktikum === metadata.mataPraktikum);
    if (schedule && metadata.pertemuan && metadata.hariTanggalSesi) {
      const p = metadata.pertemuan;
      store.setSchedules(store.schedules.map(s => s.id === schedule.id ? { ...schedule, customDates: { ...(schedule.customDates || {}), [p]: metadata.hariTanggalSesi } } : s));
      toast.success(`Jadwal tersimpan permanen untuk Pertemuan ${p}!`);
    } else {
      toast.info('Pilih jadwal praktikum resmi untuk menyimpan jadwal custom.');
    }
  };

  const handleGenerate = async () => {
    if (!metadata.nama || !metadata.nim || !metadata.mataPraktikum) {
      toast.error('Please fill in the required metadata fields (Nama, NIM, Mata Praktikum).');
      return;
    }
    saveCurrentSession();
    await generateReportAI({
      metadata, preTest, preTestImages, modulContext, postTest, postTestImages, implImages,
      parsedNotebooks, notebookFiles, postTestParsedNotebooks, postTestNotebookFiles,
      session, store, setAiPreviewData, setGeneratedDocxBlob
    });
  };

  const handleDownload = async () => {
    let blob = generatedDocxBlob;
    if (!blob && aiPreviewData) {
       let logoBlob: Blob | null = null;
       try {
         const logoRes = await fetch('/logo-uad.png');
         if (logoRes.ok) logoBlob = await logoRes.blob();
       } catch (e) {}

       blob = await generateDocx(
         metadata, [...parsedNotebooks, ...postTestParsedNotebooks], aiPreviewData, logoBlob, 
         preTestImages, implImages, postTestImages, modulContext, postTest, parsedNotebooks.length
       );
       setGeneratedDocxBlob(blob);
    }
    if (blob) {
      let fileNameFormat = store.globalFileNameFormat || '{nim}_{nama}_{pertemuan}_{matkul}';
      const schedule = store.schedules.find(s => s.mataPraktikum === metadata.mataPraktikum);
      if (schedule && schedule.fileNameFormat) {
          fileNameFormat = schedule.fileNameFormat;
      }
      
      let fileName = fileNameFormat
        .replace(/{nim}/g, metadata.nim || 'NIM')
        .replace(/{nama}/g, metadata.nama || 'Nama')
        .replace(/{matkul}/g, metadata.mataPraktikum || 'Praktikum')
        .replace(/{pertemuan}/g, metadata.pertemuan?.toString() || '0')
        .replace(/{dosen}/g, metadata.dosen || 'Dosen')
        .replace(/{laboratorium}/g, metadata.laboratorium || 'Lab');
        
      if (!fileName.toLowerCase().endsWith('.docx')) {
          fileName += '.docx';
      }
      
      saveAs(blob, fileName);
    } else {
       toast.error("Please generate the report first before downloading.");
    }
  };

  useEffect(() => {
    const fn = () => handleDownload();
    window.addEventListener('export-active-session', fn);
    return () => window.removeEventListener('export-active-session', fn);
  }, [handleDownload]);

  const handleCompileEdit = async () => {
    await compileEditAI({
      chatInput, setChatInput, aiPreviewData, setAiPreviewData, metadata, parsedNotebooks, postTestParsedNotebooks,
      preTestImages, implImages, postTestImages, modulContext, postTest, setGeneratedDocxBlob, session, store
    });
  };

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
                     onAiDataChange={(newData) => {
                        setAiPreviewData(newData);
                        setGeneratedDocxBlob(null);
                     }}
                     onMetadataChange={(newMeta) => {
                        setMetadata(newMeta);
                        setGeneratedDocxBlob(null);
                     }}
                  />
                  <Button 
                    onClick={handleDownload} 
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#2F81F7] hover:bg-[#2563EB] text-white rounded-sm py-3 px-5 gap-2 transition-colors z-40 font-medium text-[12px] tracking-wide uppercase border border-[#1F3A66] h-10"
                  >
                    <Save className="w-4 h-4" /> {generatedDocxBlob ? 'Download .docx' : 'Save & Download'}
                  </Button>
               </div>
           ) : (
               <div className="flex flex-col items-center justify-center h-full text-[#6E6E6E] w-full max-w-md mt-20">
                  <div className="w-14 h-14 bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center mb-5">
                    <FileText className="w-6 h-6 text-[#4A4A4A]" />
                  </div>
                  <h2 className="text-[13px] font-semibold tracking-[0.18em] uppercase text-[#EDEDED]">Empty Document</h2>
                  <p className="text-center mt-3 text-[11px] text-[#A1A1A1] leading-relaxed max-w-sm font-mono">
                    // open the Copilot panel on the right or head to the <span className="text-[#EDEDED]">SETUP</span> tab to enter report data and generate a document.
                  </p>
                  <button 
                    onClick={() => { store.toggleCopilot(); setActiveSidebarTab('settings'); }} 
                    className="mt-6 h-8 px-4 border border-[#1F1F1F] hover:border-[#2A2A2A] bg-transparent hover:bg-[#111111] text-[#EDEDED] text-[11px] font-medium tracking-wide uppercase transition-colors rounded-sm"
                  >
                     Start Report Setup
                  </button>
               </div>
           )}
       </div>

       {/* Right side: Resizable Sidebar Container */}
       {store.isCopilotOpen && (
          <div 
            className="shrink-0 flex flex-row relative h-full bg-[#0A0A0A] z-20 border-l border-[#1F1F1F]"
            style={{ width: `${sidebarWidth}px` }}
          >
            {/* Draggable Handle */}
            <div 
              onMouseDown={handleMouseDown}
              className={`absolute -left-1 top-0 bottom-0 w-2 cursor-col-resize z-50 flex flex-col items-center justify-center group ${isDragging ? 'bg-[#2F81F7]/20' : 'hover:bg-[#2F81F7]/10'}`}
            >
              <div className={`w-px h-10 transition-colors ${isDragging ? 'bg-[#2F81F7]' : 'bg-[#1F1F1F] group-hover:bg-[#2F81F7]'}`} />
            </div>

            {/* Sidebar Content */}
            <div className="w-full h-full flex flex-col overflow-hidden">
                {/* Header Panel */}
                <div className="h-9 flex items-center justify-between pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A]">
                  <div className="flex h-full">
                    <button 
                      onClick={() => setActiveSidebarTab('chat')} 
                      className={`relative h-9 px-3 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors ${activeSidebarTab === 'chat' ? 'text-[#EDEDED]' : 'text-[#6E6E6E] hover:text-[#A1A1A1]'}`}
                    >
                      Copilot
                      {activeSidebarTab === 'chat' && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2F81F7]" />
                      )}
                    </button>
                    <button 
                      onClick={() => setActiveSidebarTab('settings')} 
                      className={`relative h-9 px-3 text-[10px] font-semibold tracking-[0.18em] uppercase transition-colors ${activeSidebarTab === 'settings' ? 'text-[#EDEDED]' : 'text-[#6E6E6E] hover:text-[#A1A1A1]'}`}
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
                      getRootPropsPt={getRootPropsPt} getInputPropsPt={getInputPropsPt} isDragActivePt={isDragActivePt} postTestNotebookFiles={postTestNotebookFiles} setPostTestNotebookFiles={setPostTestNotebookFiles} postTestParsedNotebooks={postTestParsedNotebooks} setPostTestParsedNotebooks={setPostTestParsedNotebooks}
                      saveCurrentSession={saveCurrentSession} handleSaveCustomDate={handleSaveCustomDate} handleGenerate={handleGenerate} aiPreviewData={aiPreviewData} isGenerating={isGenerating}
                    />
                  )}
                </div>
            </div>
          </div>
       )}
    </div>
  );
}