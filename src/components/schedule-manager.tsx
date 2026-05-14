'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore, PracticumSchedule } from '@/lib/store';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Calendar, Trash2, Check, Loader2, Pencil, Upload, X, Bot, Sparkles, ChevronDown,
  Plus, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDropzone } from 'react-dropzone';
import { convertFileToBase64 } from '@/lib/file-utils';
import { extractScheduleFromText, extractModuleFromPdf } from '@/lib/ai-utils';

export function ScheduleManager() {
  const store = useAppStore();
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PracticumSchedule>>({});

  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [extractionLogs, isExtractingPdf]);

  const handleParse = async () => {
    if (!inputText.trim()) return;
    const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
    if (!apiKeyToUse) {
      toast.error('API Key Gemini belum diatur. Silakan tambahkan di Preferences.');
      return;
    }
    setIsParsing(true);
    try {
      const data = await extractScheduleFromText(inputText, apiKeyToUse);
      if (data.schedules && Array.isArray(data.schedules)) {
        const newSchedules: PracticumSchedule[] = data.schedules.map((s: any) => ({
          ...s,
          id: crypto.randomUUID(),
        }));
        store.setSchedules([...store.schedules, ...newSchedules]);
        setInputText('');
        setShowConfig(false);
        toast.success(`Added ${newSchedules.length} schedules`);
      }
    } catch (error) {
      console.error('Failed to parse schedule:', error);
      toast.error('Gagal memproses jadwal.');
    } finally {
      setIsParsing(false);
    }
  };

  const startEdit = (schedule: PracticumSchedule) => {
    setEditingId(schedule.id);
    setEditForm(schedule);
    setShowConfig(false);
  };

  const startAddManual = () => {
    const newId = `new-${Date.now()}`;
    setEditingId(newId);
    setEditForm({ id: newId });
    setShowConfig(false);
  };

  const saveEdit = () => {
    if (editingId && editForm) {
      if (editingId.startsWith('new-')) {
        const newSchedule = {
          id: crypto.randomUUID(),
          mataPraktikum: editForm.mataPraktikum || '',
          hari: editForm.hari || '',
          jamMulai: editForm.jamMulai || '',
          jamSelesai: editForm.jamSelesai || '',
          laboratorium: editForm.laboratorium || '',
          dosen: editForm.dosen || '',
          ...editForm,
        } as PracticumSchedule;
        store.setSchedules([...store.schedules, newSchedule]);
      } else {
        store.updateSchedule(editingId, editForm);
      }
      setEditingId(null);
      setEditForm({});
      toast.success('Schedule saved');
    }
  };

  const dayOrder: Record<string, number> = {
    senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6, minggu: 7,
  };

  const sortedSchedules = [...store.schedules].sort((a, b) => {
    const dayA = dayOrder[a.hari?.toLowerCase()] || 99;
    const dayB = dayOrder[b.hari?.toLowerCase()] || 99;
    if (dayA !== dayB) return dayA - dayB;
    const timeA = a.jamMulai || '99:99';
    const timeB = b.jamMulai || '99:99';
    return timeA.localeCompare(timeB);
  });

  const onDropPdf = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      const base64Data = await convertFileToBase64(file);
      setEditForm((prev) => ({
        ...prev,
        pdfBase64: base64Data,
        pdfFileName: file.name,
      }));
      toast.success(`Attached: ${file.name}`);
    } catch (e) {
      console.error(e);
      toast.error('Gagal membaca file PDF.');
    }
  }, []);

  const handleProcessPdf = async () => {
    if (!editForm.pdfBase64) return;
    const apiKeyToUse = process.env.GEMINI_API_KEY || store.geminiApiKey;
    if (!apiKeyToUse) {
      toast.error('API Key Gemini belum diatur.');
      return;
    }
    setIsExtractingPdf(true);
    setExtractionLogs([]);
    try {
      const call = await extractModuleFromPdf(editForm.pdfBase64, apiKeyToUse, (msg) => {
        setExtractionLogs((prev) => {
          const newLogs = [...prev, msg];
          if (newLogs.length > 15) return newLogs.slice(newLogs.length - 15);
          return newLogs;
        });
      });

      if (call && call.name === 'parse_module_praktikum') {
        const { pertemuan_data } = call.args as any;
        const mappedData: any = {};
        if (Array.isArray(pertemuan_data)) {
          pertemuan_data.forEach((p: any) => {
            if (p.pertemuan) {
              let compiledPreTest = '';
              if (p.teori_pendukung) {
                compiledPreTest += `### Teori Pendukung / Konteks Pembelajaran\n${p.teori_pendukung}\n\n`;
              }
              if (p.pre_test) {
                compiledPreTest += `### Soal Pre-Test\n${p.pre_test}`;
              }
              mappedData[p.pertemuan] = {
                judul: p.judul || '',
                langkah: p.langkah || '',
                pre_test: compiledPreTest.trim() || '',
                post_test: p.post_test || '',
                config: {
                  includePreTest: true,
                  includeLangkah: true,
                  includePostTest: false,
                },
              };
            }
          });

          setEditForm((prev) => ({
            ...prev,
            moduleData: { ...prev.moduleData, ...mappedData },
          }));

          setExtractionLogs((prev) => [
            ...prev,
            `[SUCCESS] Extracted ${Object.keys(mappedData).length} pertemuan.`,
          ]);
          toast.success(`Extracted ${Object.keys(mappedData).length} pertemuan`);
        } else {
          setExtractionLogs((prev) => [...prev, `[ERROR] Unable to detect pertemuan array.`]);
          toast.error('Gagal mendeteksi daftar pertemuan.');
        }
      } else {
        setExtractionLogs((prev) => [...prev, `[ERROR] Extraction aborted.`]);
        toast.error('Modul mungkin tidak dapat dibaca dengan baik.');
      }
    } catch (e) {
      console.error(e);
      setExtractionLogs((prev) => [...prev, `[FATAL] API communication error.`]);
      toast.error('Terjadi kesalahan saat memproses PDF.');
    } finally {
      setTimeout(() => setIsExtractingPdf(false), 2000);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropPdf,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const headerAction = (label: string, onClick: () => void, icon?: React.ReactNode) => (
    <button
      onClick={onClick}
      className="h-6 px-2 flex items-center gap-1 text-[10px] font-medium text-[#EDEDED] bg-transparent hover:bg-[#161616] border border-[#1F1F1F] hover:border-[#2A2A2A] transition-colors rounded-sm"
    >
      {icon}
      <span className="tracking-wide uppercase">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#0F0F0F] border border-[#1F1F1F] min-h-0 overflow-hidden">
      {/* Panel header */}
      <header className="shrink-0 h-9 flex items-center justify-between px-3 border-b border-[#1F1F1F] bg-[#0A0A0A]">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-[#6E6E6E]" />
          <h2 className="text-[12px] font-semibold text-[#EDEDED]">
            Practicum schedule
          </h2>
          <span className="font-mono text-[10px] text-[#6E6E6E] pl-2 border-l border-[#1F1F1F] ml-1">
            {store.schedules.length} rows
          </span>
        </div>
        {!editingId && (
          <div className="flex items-center gap-1">
            {!showConfig && headerAction('Add', startAddManual, <Plus className="w-3 h-3" />)}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`h-6 px-2 flex items-center gap-1 text-[10px] font-medium transition-colors rounded-sm border ${
                showConfig
                  ? 'bg-[#1C1C1C] border-[#2A2A2A] text-[#EDEDED]'
                  : 'border-[#1F1F1F] hover:border-[#2A2A2A] hover:bg-[#161616] text-[#EDEDED]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#2F81F7]" />
              <span className="tracking-wide uppercase">
                {showConfig ? 'Cancel' : 'Paste Text'}
              </span>
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ================== EDIT FORM ================== */}
        {editingId ? (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1F1F1F]">
              <h3 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#EDEDED]">
                {editingId.startsWith('new-') ? 'New Schedule' : 'Edit Schedule'}
              </h3>
              <button
                onClick={() => setEditingId(null)}
                className="w-6 h-6 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] rounded-sm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Mata Praktikum', key: 'mataPraktikum' },
                { label: 'Dosen', key: 'dosen' },
                { label: 'Laboratorium', key: 'laboratorium' },
                { label: 'Hari', key: 'hari' },
                { label: 'Jam Mulai', key: 'jamMulai' },
                { label: 'Jam Selesai', key: 'jamSelesai' },
              ].map(({ label, key }) => (
                <div key={key} className="space-y-1">
                  <label className="block text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E]">
                    {label}
                  </label>
                  <Input
                    className="h-8 bg-[#0A0A0A] border-[#1F1F1F] rounded-sm text-[#EDEDED] focus-visible:ring-0 focus-visible:border-[#2F81F7]"
                    value={(editForm as any)[key] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                  />
                </div>
              ))}

              <div className="space-y-1 col-span-2">
                <label className="block text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E]">
                  File Name Format
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    className="h-8 bg-[#0A0A0A] border-[#1F1F1F] rounded-sm flex-1 font-mono text-[11px] text-[#EDEDED] focus-visible:ring-0 focus-visible:border-[#2F81F7]"
                    placeholder={store.globalFileNameFormat || '{nim}_{nama}'}
                    value={editForm.fileNameFormat || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, fileNameFormat: e.target.value })
                    }
                  />
                  <span className="text-[10px] text-[#6E6E6E] font-mono whitespace-nowrap">
                    // leave empty → global
                  </span>
                </div>
                <div className="px-2 py-1.5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-sm">
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-[#6E6E6E] uppercase tracking-wider">preview</span>
                    <span className="text-[#2EA043] truncate">
                      {(editForm.fileNameFormat || store.globalFileNameFormat || '{nim}_{nama}')
                        .replace(/{nim}/g, '2200018401')
                        .replace(/{nama}/g, 'Mohammad Farid Hendianto')
                        .replace(/{matkul}/g, editForm.mataPraktikum || 'MataPraktikum')
                        .replace(/{pertemuan}/g, '4')
                        .replace(/{dosen}/g, editForm.dosen || 'Dosen')
                        .replace(/{laboratorium}/g, editForm.laboratorium || 'Laboratorium') +
                        '.docx'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-crawling zone */}
            <div className="pt-3 border-t border-[#1F1F1F]">
              <h4 className="text-[12px] font-semibold text-[#EDEDED] mb-2 flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-[#2F81F7]" />
                Auto-fill module data
                <span className="text-[11px] font-normal text-[#6E6E6E]">
                  Optional
                </span>
              </h4>

              <div
                {...getRootProps()}
                className={`border border-dashed text-center cursor-pointer transition-colors relative overflow-hidden rounded-sm ${
                  isExtractingPdf
                    ? 'border-[#1F1F1F] bg-[#050505]'
                    : isDragActive
                    ? 'border-[#2F81F7] bg-[#0F1A2E]'
                    : 'border-[#2A2A2A] hover:border-[#3A3A3A] bg-[#0A0A0A]'
                }`}
              >
                {!isExtractingPdf && <input {...getInputProps()} />}

                {isExtractingPdf ? (
                  // Terminal log UI
                  <div
                    className="flex flex-col w-full text-left h-full min-h-[180px] cursor-default bg-[#050505]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between px-3 h-7 border-b border-[#1F1F1F] bg-[#0A0A0A]">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-[#F85149] rounded-full" />
                          <span className="w-2 h-2 bg-[#D29922] rounded-full" />
                          <span className="w-2 h-2 bg-[#2EA043] rounded-full" />
                        </div>
                        <span className="font-mono text-[10px] text-[#6E6E6E] ml-2">
                          crawler ~ gemini-flash
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin" />
                        <span className="font-mono text-[10px] text-[#2F81F7]">RUNNING</span>
                      </div>
                    </div>
                    <div className="p-3 h-[160px] overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed flex flex-col gap-0.5">
                      {extractionLogs.length === 0 ? (
                        <div className="text-[#4A4A4A]">Waiting to start…</div>
                      ) : (
                        extractionLogs.map((log, i) => {
                          let colorClass = 'text-[#A1A1A1]';
                          if (i === extractionLogs.length - 1) colorClass = 'text-[#EDEDED]';
                          if (log.includes('[SUCCESS]')) colorClass = 'text-[#2EA043]';
                          if (log.includes('[ERROR]') || log.includes('[FATAL]'))
                            colorClass = 'text-[#F85149]';
                          return (
                            <div key={i} className={`flex gap-2 ${colorClass}`}>
                              <span className="text-[#4A4A4A] shrink-0 select-none">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="break-words whitespace-pre-wrap">{log}</span>
                            </div>
                          );
                        })
                      )}
                      <div className="flex gap-2 text-[#EDEDED] mt-0.5">
                        <span className="text-[#4A4A4A] shrink-0">
                          {String(extractionLogs.length + 1).padStart(2, '0')}
                        </span>
                        <span className="terminal-caret" />
                      </div>
                      <div ref={logEndRef} className="h-1 shrink-0" />
                    </div>
                  </div>
                ) : editForm.pdfFileName ? (
                  <div className="py-5 px-4 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-sm">
                      <FileText className="w-3.5 h-3.5 text-[#2F81F7]" />
                      <span className="font-mono text-[11px] text-[#EDEDED] truncate max-w-[300px]">
                        {editForm.pdfFileName}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#6E6E6E]">Click or drop a new file to replace</p>
                  </div>
                ) : (
                  <div className="py-6 px-4 flex flex-col items-center gap-2">
                    <Upload className="w-4 h-4 text-[#6E6E6E]" />
                    <p className="text-[12px] text-[#EDEDED] font-medium">Drop PDF module here</p>
                    <p className="text-[10px] text-[#6E6E6E]">
                      or click to browse
                    </p>
                  </div>
                )}
              </div>

              {editForm.pdfBase64 && !isExtractingPdf && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={handleProcessPdf}
                    className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] transition-colors rounded-sm"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span className="tracking-wide uppercase">Crawl Module</span>
                  </button>
                </div>
              )}

              {editForm.moduleData && Object.keys(editForm.moduleData).length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#2EA043]">
                      {Object.keys(editForm.moduleData).length} modules extracted
                    </span>
                  </div>

                  {/* Global bulk config */}
                  <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-sm">
                    <div className="h-7 px-3 flex items-center border-b border-[#1F1F1F]">
                      <span className="text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E]">
                        Bulk toggles
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 p-2.5">
                      {[
                        { key: 'includePreTest', label: 'Pre-test + theory' },
                        { key: 'includeLangkah', label: 'Lab steps', defaultTrue: true },
                        { key: 'includePostTest', label: 'Post-test' },
                      ].map(({ key, label, defaultTrue }) => {
                        const checked = Object.values(editForm.moduleData || {}).every((md: any) =>
                          defaultTrue ? md.config?.[key] !== false : md.config?.[key]
                        );
                        return (
                          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setEditForm((prev) => {
                                  if (!prev.moduleData) return prev;
                                  const newData = { ...prev.moduleData };
                                  Object.keys(newData).forEach((k) => {
                                    newData[Number(k)] = {
                                      ...newData[Number(k)],
                                      config: {
                                        ...newData[Number(k)].config,
                                        [key]: e.target.checked,
                                      } as any,
                                    };
                                  });
                                  return { ...prev, moduleData: newData };
                                });
                              }}
                              className="w-3 h-3 accent-[#2F81F7] bg-[#0A0A0A]"
                            />
                            <span className="text-[10px] text-[#EDEDED]">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {Object.entries(editForm.moduleData)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([pertemuan, data]) => (
                      <details
                        key={pertemuan}
                        className="group bg-[#0A0A0A] border border-[#1F1F1F] rounded-sm"
                      >
                        <summary className="cursor-pointer px-3 h-8 flex items-center justify-between hover:bg-[#111111] list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-[#6E6E6E] shrink-0">
                              P{String(pertemuan).padStart(2, '0')}
                            </span>
                            <span className="text-[11px] text-[#EDEDED] truncate">
                              {data.judul || '(untitled)'}
                            </span>
                          </div>
                          <ChevronDown className="w-3.5 h-3.5 text-[#6E6E6E] transition-transform group-open:rotate-180 shrink-0" />
                        </summary>
                        <div className="border-t border-[#1F1F1F] p-3 bg-[#050505]">
                          <div className="flex flex-wrap gap-4 mb-3 pb-3 border-b border-[#1F1F1F]">
                            {[
                              { key: 'includePreTest', label: 'Pre-test' },
                              { key: 'includeLangkah', label: 'Steps', defaultTrue: true },
                              { key: 'includePostTest', label: 'Post-test' },
                            ].map(({ key, label, defaultTrue }) => (
                              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={
                                    defaultTrue
                                      ? data.config?.[key as keyof typeof data.config] !== false
                                      : data.config?.[key as keyof typeof data.config] ?? false
                                  }
                                  onChange={(e) => {
                                    setEditForm((prev) => ({
                                      ...prev,
                                      moduleData: {
                                        ...prev.moduleData,
                                        [pertemuan]: {
                                          ...prev.moduleData![Number(pertemuan)],
                                          config: {
                                            ...prev.moduleData![Number(pertemuan)].config,
                                            [key]: e.target.checked,
                                          } as any,
                                        },
                                      },
                                    }));
                                  }}
                                  className="w-3 h-3 accent-[#2F81F7] bg-[#0A0A0A]"
                                />
                                <span className="text-[10px] text-[#A1A1A1]">{label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="prose prose-invert prose-sm max-w-none text-[11px] text-[#A1A1A1] prose-p:leading-snug prose-li:my-0.5 prose-p:text-[11px] prose-headings:text-[12px] prose-ul:text-[11px] [&_pre]:bg-[#0A0A0A] [&_pre]:p-2.5 [&_pre]:rounded-sm [&_pre]:border [&_pre]:border-[#1F1F1F] [&_code]:text-[#2EA043] [&_code]:font-mono">
                            {data.pre_test && (
                              <div className="mb-3 bg-[#0A0A0A] border border-[#1F1F1F] p-2 rounded-sm">
                                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#2F81F7] mb-1">
                                  # pre-test + theory
                                </p>
                                <ReactMarkdown>{data.pre_test}</ReactMarkdown>
                              </div>
                            )}
                            <div className="mb-3">
                              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#2EA043] mb-1">
                                # lab-steps
                              </p>
                              <ReactMarkdown>{data.langkah}</ReactMarkdown>
                            </div>
                            {data.post_test && (
                              <div className="bg-[#0A0A0A] border border-[#1F1F1F] p-2 rounded-sm">
                                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#A371F7] mb-1">
                                  # post-test
                                </p>
                                <ReactMarkdown>{data.post_test}</ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      </details>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#1F1F1F] gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="h-7 px-3 text-[11px] text-[#A1A1A1] hover:text-white hover:bg-[#161616] border border-[#1F1F1F] hover:border-[#2A2A2A] transition-colors rounded-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="h-7 px-4 flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] transition-colors rounded-sm"
              >
                <Check className="w-3 h-3" />
                <span className="tracking-wide uppercase">Save</span>
              </button>
            </div>
          </div>
        ) : showConfig ? (
          <div className="p-4 space-y-3">
            <label className="block text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E]">
              Paste schedule table
            </label>
            <Textarea
              placeholder="Paste schedule (No, Praktikum, Dosen, Hari, Jam…)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[120px] bg-[#0A0A0A] border-[#1F1F1F] rounded-sm font-mono text-[11px] text-[#EDEDED] focus-visible:ring-0 focus-visible:border-[#2F81F7] resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={isParsing || !inputText.trim()}
                className="h-7 px-4 flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#161616] disabled:text-[#4A4A4A] disabled:cursor-not-allowed transition-colors rounded-sm"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="tracking-wide uppercase">Parsing…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span className="tracking-wide uppercase">Parse</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ================== DATA TABLE ================== */
          <div className="flex flex-col">
            {store.schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 px-6 text-center">
                <div className="w-10 h-10 flex items-center justify-center border border-[#1F1F1F] mb-4 rounded-sm">
                  <Calendar className="w-4 h-4 text-[#4A4A4A]" />
                </div>
                <p className="text-[12px] text-[#EDEDED] font-medium">No schedules yet</p>
                <p className="text-[11px] text-[#6E6E6E] mt-1 max-w-[280px]">
                  Add a practicum schedule manually, or paste raw text to import several at once.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-[#0A0A0A]">
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F] w-10">
                        #
                      </th>
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F]">
                        Subject
                      </th>
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F]">
                        Day
                      </th>
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F]">
                        Time
                      </th>
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F]">
                        Lab
                      </th>
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F]">
                        Lecturer
                      </th>
                      <th className="px-3 py-2 font-mono text-[9px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] border-b border-[#1F1F1F] text-right w-20">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSchedules.map((s, index) => (
                      <tr
                        key={s.id}
                        className="group hover:bg-[#111111] transition-colors border-b border-[#141414] last:border-0"
                      >
                        <td className="px-3 py-2 text-[11px] text-[#4A4A4A] font-mono">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="px-3 py-2 text-[12px] text-[#EDEDED]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{s.mataPraktikum}</span>
                            {s.moduleData && Object.keys(s.moduleData).length > 0 && (
                              <span
                                title={`${Object.keys(s.moduleData).length} modules parsed`}
                                className="shrink-0 inline-flex items-center gap-0.5 text-[8px] font-mono font-medium tracking-wider uppercase px-1 py-[1px] border border-[#1F3A66] text-[#2F81F7] bg-[#0F1A2E]"
                              >
                                <Bot className="w-2 h-2" />
                                AI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-[#A1A1A1] capitalize">
                          {s.hari}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-[#A1A1A1] font-mono">
                          {s.jamMulai}–{s.jamSelesai}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-[#A1A1A1]">{s.laboratorium}</td>
                        <td className="px-3 py-2 text-[11px] text-[#A1A1A1] truncate max-w-[180px]">
                          {s.dosen}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(s)}
                              title="Edit"
                              className="w-6 h-6 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#1C1C1C] rounded-sm"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() =>
                                store.setSchedules(
                                  store.schedules.filter((item) => item.id !== s.id)
                                )
                              }
                              title="Delete"
                              className="w-6 h-6 flex items-center justify-center text-[#A1A1A1] hover:text-[#F85149] hover:bg-[#1C1C1C] rounded-sm"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {store.schedules.length > 0 && !editingId && !showConfig && (
              <div className="flex justify-start items-center h-7 px-3 border-t border-[#1F1F1F] bg-[#0A0A0A] shrink-0">
                <button
                  onClick={() => store.setSchedules([])}
                  className="text-[10px] font-mono text-[#6E6E6E] hover:text-[#F85149] transition-colors"
                >
                  // clear all schedules
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
