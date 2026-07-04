/* --- components/settings-panel.tsx --- */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Check, Plus, X, Save, User, BookOpen, Database, Sparkles } from 'lucide-react';
import { AIReportData, UserImage } from '@/lib/types';
import { ImageUploader } from './image-uploader';
import { DropzoneRootProps, DropzoneInputProps } from 'react-dropzone';

interface SettingsPanelProps {
  metadata: any;
  setMetadata: (meta: any) => void;
  store: any;
  isAddingMk: boolean;
  setIsAddingMk: (val: boolean) => void;
  newMk: string;
  setNewMk: (val: string) => void;
  handleCreateNewMataPraktikum: () => void;
  handleMataPraktikumChange: (v: string) => void;
  handlePertemuanChange: (v: number) => void;
  getRootProps: <T extends DropzoneRootProps>(props?: T) => T;
  getInputProps: <T extends DropzoneInputProps>(props?: T) => T;
  isDragActive: boolean;
  notebookFiles: File[];
  setNotebookFiles: (files: File[]) => void;
  parsedNotebooks: any[];
  setParsedNotebooks: (nb: any[]) => void;
  setGeneratedDocxBlob: (b: Blob | null) => void;
  preTest: string;
  setPreTest: (val: string) => void;
  handlePasteToUploader: (e: any, setter: any) => void;
  preTestImages: UserImage[];
  setPreTestImages: (imgs: UserImage[]) => void;
  modulContext: string;
  setModulContext: (val: string) => void;
  implImages: UserImage[];
  setImplImages: (imgs: UserImage[]) => void;
  postTest: string;
  setPostTest: (val: string) => void;
  postTestImages: UserImage[];
  setPostTestImages: (imgs: UserImage[]) => void;
  ulasanPraktikum: string;
  setUlasanPraktikum: (val: string) => void;
  getRootPropsPt: <T extends DropzoneRootProps>(props?: T) => T;
  getInputPropsPt: <T extends DropzoneInputProps>(props?: T) => T;
  isDragActivePt: boolean;
  postTestNotebookFiles: File[];
  setPostTestNotebookFiles: (files: File[]) => void;
  postTestParsedNotebooks: any[];
  setPostTestParsedNotebooks: (nb: any[]) => void;
  saveCurrentSession: () => void;
  handleSaveCustomDate?: () => void;
  handleGenerate: () => void;
  aiPreviewData: AIReportData | null;
  isGenerating: boolean;
}

export function SettingsPanel({
  metadata, setMetadata, store,
  isAddingMk, setIsAddingMk, newMk, setNewMk,
  handleCreateNewMataPraktikum, handleMataPraktikumChange, handlePertemuanChange,
  getRootProps, getInputProps, isDragActive, notebookFiles, setNotebookFiles, parsedNotebooks, setParsedNotebooks, setGeneratedDocxBlob,
  preTest, setPreTest, handlePasteToUploader, preTestImages, setPreTestImages,
  modulContext, setModulContext, implImages, setImplImages,
  postTest, setPostTest, postTestImages, setPostTestImages, ulasanPraktikum, setUlasanPraktikum,
  getRootPropsPt, getInputPropsPt, isDragActivePt, postTestNotebookFiles, setPostTestNotebookFiles, postTestParsedNotebooks, setPostTestParsedNotebooks,
  saveCurrentSession, handleSaveCustomDate, handleGenerate, aiPreviewData, isGenerating
}: SettingsPanelProps) {

  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  // Hitung pertemuan mana saja yang sudah dikerjakan secara lebih ketat (handling number & string)
  const completedPertemuans = new Set<number>();
  if (metadata.mataPraktikum) {
    const currentMk = metadata.mataPraktikum.trim();
    
    // Dari session yang pernah digenerate/disimpan
    if (store.sessions && Array.isArray(store.sessions)) {
      store.sessions.forEach((s: any) => {
        if (s.metadata?.reportType !== 'kuliah' && s.metadata?.mataPraktikum?.trim() === currentMk && s.metadata?.pertemuan) {
          completedPertemuans.add(Number(s.metadata.pertemuan));
        }
      });
    }
    
    // Dari progress checklist manual di Home tab
    if (store.manualProgress && store.manualProgress[currentMk]) {
      store.manualProgress[currentMk].forEach((p: number) => completedPertemuans.add(Number(p)));
    }
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-6 text-gray-300">
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-100 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-400" /> Data Mahasiswa
        </h3>
        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">Nama Mahasiswa</Label>
          <Input 
            value={metadata.nama} 
            onChange={e => {
                setMetadata({...metadata, nama: e.target.value});
                store.setProfile({ nama: e.target.value });
            }} 
            className="bg-[#242424] border-[#444]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">NIM</Label>
          <Input 
            value={metadata.nim} 
            onChange={e => {
                setMetadata({...metadata, nim: e.target.value});
                store.setProfile({ nim: e.target.value });
            }} 
            className="bg-[#242424] border-[#444]"
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-[#333]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-400" /> Konteks Praktikum / Tugas
          </h3>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-200" title="Otomatis unduh notebook dari link Google Colab yang dimasukkan pada Context/Post-test">
            <input 
              type="checkbox" 
              checked={store.autoFetchColab}
              onChange={(e) => store.setAutoFetchColab(e.target.checked)}
              className="accent-blue-500 rounded bg-[#242424] border-[#444]"
            />
            Auto-fetch Colab (.ipynb)
          </label>
        </div>
        
        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">Jenis Laporan</Label>
          <div className="flex gap-4 p-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input 
                type="radio" 
                name="reportType" 
                value="praktikum"
                checked={metadata.reportType === 'praktikum' || !metadata.reportType}
                onChange={() => setMetadata({...metadata, reportType: 'praktikum'})}
                className="accent-blue-500 bg-[#242424] border-[#444]"
              />
              <span className="text-gray-300">Laporan Praktikum</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input 
                type="radio" 
                name="reportType" 
                value="kuliah"
                checked={metadata.reportType === 'kuliah'}
                onChange={() => setMetadata({...metadata, reportType: 'kuliah'})}
                className="accent-blue-500 bg-[#242424] border-[#444]"
              />
              <span className="text-gray-300">Laporan Kuliah</span>
            </label>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">{metadata.reportType === 'kuliah' ? 'Mata Kuliah' : 'Mata Praktikum'}</Label>
          {isAddingMk ? (
            <div className="flex space-x-2">
              <Input placeholder="Baru:" value={newMk} onChange={e => setNewMk(e.target.value)} className="bg-[#242424] border-[#444]"/>
              <Button size="icon" onClick={handleCreateNewMataPraktikum} className="bg-[#333] hover:bg-[#444]"><Check className="w-4 h-4"/></Button>
              <Button size="icon" variant="ghost" onClick={() => setIsAddingMk(false)} className="hover:bg-[#333]">x</Button>
            </div>
          ) : (
            <div className="flex space-x-2">
              <Select value={metadata.mataPraktikum} onValueChange={handleMataPraktikumChange}>
                <SelectTrigger className="w-full bg-[#242424] border-[#444]">
                  <SelectValue placeholder="Pilih..." />
                </SelectTrigger>
                <SelectContent className="bg-[#242424] border-[#444] text-gray-200">
                  {store.schedules.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-blue-400">Jadwal Praktikum</SelectLabel>
                      {store.schedules.map((s: any) => (
                        <SelectItem key={s.id} value={`sch:${s.id}`}>
                          {s.mataPraktikum} ({s.hari} {s.jamMulai})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel className="text-[#888]">Daftar Mata Praktikum</SelectLabel>
                    {store.mataPraktikumList.map((mk: string) => (
                      <div key={mk} className="flex items-center w-full group overflow-hidden pl-1">
                        <SelectItem value={mk} className="flex-1 cursor-pointer">{mk}</SelectItem>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 mr-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-red-400/10 z-10 shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            store.removeMataPraktikum(mk);
                            if (metadata.mataPraktikum === mk) {
                              setMetadata({...metadata, mataPraktikum: ''});
                            }
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => setIsAddingMk(true)} className="bg-[#242424] border-[#444] hover:bg-[#333] shrink-0"><Plus className="w-4 h-4"/></Button>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">{metadata.reportType === 'kuliah' ? 'Topik / Judul Laporan' : 'Bab / Judul Pertemuan'}</Label>
          <Input value={metadata.judulPertemuan} onChange={e => setMetadata({...metadata, judulPertemuan: e.target.value})} className="bg-[#242424] border-[#444]"/>
        </div>
        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">Hari/Tanggal Sesi</Label>
          <div className="flex gap-2">
            <div className="relative flex-1 flex">
              <Input 
                value={metadata.hariTanggalSesi || ''} 
                onChange={e => setMetadata({...metadata, hariTanggalSesi: e.target.value})} 
                className={`bg-[#242424] border-[#444] ${metadata.reportType === 'kuliah' ? 'rounded-r-none border-r-0' : ''}`}
                placeholder="Contoh: Senin, 10 Oktober 2023"
              />
              {metadata.reportType === 'kuliah' && (
                <div className="relative flex items-center justify-center bg-[#333] border border-[#444] rounded-r-md px-3 cursor-pointer hover:bg-[#444] transition-colors" title="Pilih dari Kalender">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 pointer-events-none">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                  <input 
                    type="date" 
                    onClick={(e) => {
                      try {
                        if ('showPicker' in HTMLInputElement.prototype) {
                          e.currentTarget.showPicker();
                        }
                      } catch (err) {}
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const [y, m, d] = e.target.value.split('-');
                      const dateObj = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
                      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                      const formatted = `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                      setMetadata({...metadata, hariTanggalSesi: formatted});
                    }}
                  />
                </div>
              )}
            </div>
            {metadata.reportType === 'kuliah' && (
              <Button 
                variant="outline" 
                title="Pilih Hari Ini"
                onClick={() => {
                   const today = new Date();
                   const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                   const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                   const formatted = `${days[today.getDay()]}, ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
                   setMetadata({...metadata, hariTanggalSesi: formatted});
                }} 
                className="bg-[#242424] border-[#444] hover:bg-[#333] shrink-0 text-xs px-2"
              >
                Hari Ini
              </Button>
            )}
            {handleSaveCustomDate && metadata.reportType !== 'kuliah' && (
              <Button 
                variant="outline" 
                size="icon" 
                title="Simpan Pengecualian Jadwal Permanen (Custom Override)"
                onClick={handleSaveCustomDate} 
                className="bg-[#242424] border-[#444] hover:bg-[#333] shrink-0"
              >
                <Save className="w-4 h-4 text-blue-400"/>
              </Button>
            )}
          </div>
        </div>

        {metadata.reportType !== 'kuliah' && (
          <div className="space-y-2">
            <Label className="text-[#a0a0a0]">Pertemuan Ke-</Label>
            <Select 
              value={metadata.pertemuan?.toString() || "1"} 
              onValueChange={(v) => v && handlePertemuanChange(parseInt(v))}
            >
              <SelectTrigger className="w-full bg-[#242424] border-[#444]">
                <SelectValue placeholder="Pilih pertemuan..." />
              </SelectTrigger>
              <SelectContent className="bg-[#242424] border-[#444] text-gray-200">
                {[...Array(14)].map((_, i) => {
                  const p = i + 1;
                  const isDone = completedPertemuans.has(p);
                  return (
                    <SelectItem key={p} value={p.toString()}>
                      <div className="flex w-full items-center justify-between gap-4">
                        <span>Pertemuan {p}</span>
                        {isDone && (
                          <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Selesai
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {metadata.reportType !== 'kuliah' && (
            <div className="space-y-2">
              <Label className="text-[#a0a0a0]">Laboratorium</Label>
              <Input value={metadata.laboratorium} onChange={e => setMetadata({...metadata, laboratorium: e.target.value})} placeholder="Asisten / Lab" className="bg-[#242424] border-[#444]"/>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-[#a0a0a0]">Dosen Pengampu</Label>
            <Input value={metadata.dosen} onChange={e => setMetadata({...metadata, dosen: e.target.value})} placeholder="Nama Dosen" className="bg-[#242424] border-[#444]"/>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-[#333]">
        <h3 className="font-semibold text-gray-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-green-400" /> Konten & Referensi
        </h3>
        
        {metadata.reportType !== 'kuliah' && (
          <div className="space-y-2">
            <Label className="text-[#a0a0a0]">Soal/Jawaban Pre Test</Label>
            <Textarea 
              value={preTest} 
              onChange={e => setPreTest(e.target.value)} 
              onPaste={(e) => handlePasteToUploader(e, setPreTestImages)}
              className="h-20 bg-[#242424] border-[#444] resize-none" 
              placeholder="Isi materi pre-test di sini"
            />
            <ImageUploader images={preTestImages} onChange={setPreTestImages} label="Unggah Gambar" />
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">{metadata.reportType === 'kuliah' ? 'Latar Belakang / Pendahuluan Tugas' : 'Context Modul Praktikum'}</Label>
          <Textarea 
            value={modulContext} 
            onChange={e => setModulContext(e.target.value)} 
            onPaste={(e) => handlePasteToUploader(e, setImplImages)}
            className="h-20 bg-[#242424] border-[#444] resize-none" 
            placeholder={metadata.reportType === 'kuliah' ? "Beri penjabaran latar belakang / pendahuluan" : "Beri penjabaran agar laporan nyambung"}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[#a0a0a0]">File Kode / Notebook Pembahasan</Label>
          <div {...getRootProps()} className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors text-xs mb-2 ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-[#555] hover:border-[#777] bg-[#242424]'}`}>
            <input {...getInputProps()} />
            <p className="text-gray-400 text-[10px]">Klik atau tarik file kode / notebook di sini (Bisa lebih dari satu)</p>
          </div>
          {notebookFiles.length > 0 && (
            <div className="space-y-1 mt-2">
              {notebookFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#242424] p-2 rounded border border-[#333] text-[10px]">
                  <span className="text-green-400 truncate flex-1 mr-2">{file.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={(e) => {
                    e.stopPropagation();
                    const newFiles = [...notebookFiles];
                    newFiles.splice(idx, 1);
                    setNotebookFiles(newFiles);
                    const newParsed = [...parsedNotebooks];
                    newParsed.splice(idx, 1);
                    setParsedNotebooks(newParsed);
                    setGeneratedDocxBlob(null);
                  }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <ImageUploader images={implImages} onChange={setImplImages} label="Unggah Tangkapan Layar" />
        </div>

        {metadata.reportType !== 'kuliah' && (
          <div className="space-y-2">
            <Label className="text-[#a0a0a0]">Post-Test / Tugas (Termasuk Bukti Google Form)</Label>
            <Textarea 
              value={postTest} 
              onChange={e => setPostTest(e.target.value)} 
              onPaste={(e) => handlePasteToUploader(e, setPostTestImages)}
              className="h-20 bg-[#242424] border-[#444] resize-none" 
              placeholder="Catatan tugas tambahan atau tempel soal di sini"
            />
            <div {...getRootPropsPt()} className={`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors text-xs mb-2 ${isDragActivePt ? 'border-amber-500 bg-amber-500/10' : 'border-[#555] hover:border-[#777] bg-[#242424]'}`}>
              <input {...getInputPropsPt()} />
              <p className="text-gray-400 text-[10px]">Klik atau tarik file kode / notebook Post-Test di sini</p>
            </div>
            {postTestNotebookFiles.length > 0 && (
              <div className="space-y-1 mb-2">
                {postTestNotebookFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#242424] p-2 rounded border border-amber-500/50 text-[10px]">
                    <span className="text-amber-400 truncate flex-1 mr-2">{file.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={(e) => {
                      e.stopPropagation();
                      const newFiles = [...postTestNotebookFiles];
                      newFiles.splice(idx, 1);
                      setPostTestNotebookFiles(newFiles);
                      const newParsed = [...postTestParsedNotebooks];
                      newParsed.splice(idx, 1);
                      setPostTestParsedNotebooks(newParsed);
                      setGeneratedDocxBlob(null);
                    }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <ImageUploader images={postTestImages} onChange={setPostTestImages} label="Unggah Tangkapan Layar / Bukti PDF Google Form" />
          </div>
        )}

        {metadata.reportType !== 'kuliah' && (
          <div className="space-y-2 pt-2">
            <Label className="text-[#a0a0a0]">Feedback / Ulasan Praktikum (Opsional)</Label>
            <Textarea 
              value={ulasanPraktikum} 
              onChange={e => setUlasanPraktikum(e.target.value)} 
              className="h-20 bg-[#242424] border-[#444] resize-none" 
              placeholder="Tulis kendala, perasaan, atau saran Anda di sini. AI akan merekam dan menyusunnya dalam bahasa formal."
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button onClick={saveCurrentSession} variant="outline" className="gap-2 border-[#444] bg-[#242424] hover:bg-[#333] text-gray-300 h-10">
          <Save className="w-4 h-4" /> Simpan
        </Button>
        <Button 
          onClick={() => {
            if (aiPreviewData) {
              if (confirmRegenerate) {
                handleGenerate();
                setConfirmRegenerate(false);
              } else {
                setConfirmRegenerate(true);
                setTimeout(() => setConfirmRegenerate(false), 3000);
              }
            } else {
              handleGenerate();
            }
          }} 
          disabled={isGenerating}
          className={`gap-2 h-10 font-medium ${
            confirmRegenerate
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {confirmRegenerate ? (
            <Check className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {confirmRegenerate 
            ? 'Klik lagi untuk konfirmasi' 
            : (aiPreviewData ? 'Regenerate' : 'Generate')}
        </Button>
      </div>
    </div>
  );
}