import { useState, useEffect, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  X, Settings, Save, Key, SlidersHorizontal, Database, FileText, AlertTriangle,
  Download, Upload, ShieldAlert, RefreshCcw, Loader2, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  buildBackup,
  parseBackup,
  suggestBackupFilename,
  summarizeBackup,
  BackupParseError,
  type BackupFile,
  type BackupSummary,
} from '@/lib/backup';
import { CopilotSettingsSection } from '@/components/copilot/copilot-settings-section';

/* ---------------------------------------------------------------------------
   Flat pro-app preferences modal. Crisp 1px borders, no shadows, no pills.
--------------------------------------------------------------------------- */

type TabId = 'general' | 'model' | 'copilot' | 'save' | 'backup';

const TABS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'general', label: 'General', icon: SlidersHorizontal },
  { id: 'model',   label: 'Model',   icon: Key },
  { id: 'copilot', label: 'Copilot', icon: Wand2 },
  { id: 'save',    label: 'Export',  icon: Save },
  { id: 'backup',  label: 'Backup',  icon: Database },
];

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-3 border-b border-[#141414] last:border-0">
      <div className="pt-1">
        <div className="text-[12px] font-medium text-[#EDEDED]">{label}</div>
        {hint && (
          <div className="text-[11px] text-[#6E6E6E] mt-0.5 leading-snug">{hint}</div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="pb-4 mb-2 border-b border-[#1F1F1F]">
      <div className="flex items-center gap-2">
        <div className="text-[#6E6E6E]">{icon}</div>
        <h3 className="text-[14px] font-semibold text-[#EDEDED]">{title}</h3>
      </div>
      {description && (
        <p className="mt-1.5 text-[12px] text-[#A1A1A1] leading-relaxed">{description}</p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Backup & Restore section. Local-only round-trip — never hits any server.
--------------------------------------------------------------------------- */

function BackupSection() {
  const store = useAppStore();
  const [includeApiKey, setIncludeApiKey] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [pendingSummary, setPendingSummary] = useState<BackupSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sessionCount = store.sessions.length;
  const scheduleCount = store.schedules.length;

  const handleExport = () => {
    try {
      const file = buildBackup(
        {
          profile: store.profile,
          mataPraktikumList: store.mataPraktikumList,
          schedules: store.schedules,
          sessions: store.sessions,
          manualProgress: store.manualProgress,
          globalFileNameFormat: store.globalFileNameFormat,
          geminiApiKey: store.geminiApiKey,
        },
        { includeApiKey },
      );

      const json = JSON.stringify(file, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestBackupFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Backup downloaded (${sessionCount} ${sessionCount === 1 ? 'report' : 'reports'}, ${scheduleCount} ${scheduleCount === 1 ? 'schedule' : 'schedules'}).`);
    } catch (e) {
      console.error('export failed', e);
      toast.error('Could not create the backup. See the console for details.');
    }
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const f = e.target.files?.[0];
    // Allow re-picking the same file later by resetting the value.
    e.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      const parsed = parseBackup(text);
      setPending(parsed);
      setPendingSummary(summarizeBackup(parsed));
    } catch (err) {
      const msg = err instanceof BackupParseError ? err.message : 'Could not read this backup file.';
      setImportError(msg);
      setPending(null);
      setPendingSummary(null);
    }
  };

  const handleConfirmImport = async () => {
    if (!pending || isRestoring) return;
    setIsRestoring(true);
    try {
      // `replaceFromBackup` writes IDB and triggers `window.location.reload()`.
      // We never reach the lines after `await` on a successful path because
      // the page navigation interrupts execution; the `isRestoring` state
      // therefore only matters for the failure case below.
      await store.replaceFromBackup(pending.data);
      toast.success('Backup restored. Reloading…');
    } catch (e) {
      console.error('import failed', e);
      toast.error('Could not apply the backup.');
      setIsRestoring(false);
    }
  };

  const handleCancelImport = () => {
    setPending(null);
    setPendingSummary(null);
    setImportError(null);
  };

  return (
    <div className="max-w-[680px]">
      <SectionHeader
        icon={<Database className="w-3.5 h-3.5" />}
        title="Backup and restore"
        description="Move your workspace to another browser with a single JSON file. Everything stays on your device — the backup is never sent to a server."
      />

      {/* ---------------- EXPORT ---------------- */}
      <FieldRow
        label="Export"
        hint="Download every report, schedule, subject, and preference as one JSON file."
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#A1A1A1]">
            <span>{sessionCount} {sessionCount === 1 ? 'report' : 'reports'}</span>
            <span className="text-[#2A2A2A]">·</span>
            <span>{scheduleCount} {scheduleCount === 1 ? 'schedule' : 'schedules'}</span>
            <span className="text-[#2A2A2A]">·</span>
            <span>{store.mataPraktikumList.length} {store.mataPraktikumList.length === 1 ? 'subject' : 'subjects'}</span>
            {store.geminiApiKey && (
              <>
                <span className="text-[#2A2A2A]">·</span>
                <span className="text-[#2EA043]">API key on file</span>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeApiKey}
              onChange={(e) => setIncludeApiKey(e.target.checked)}
              disabled={!store.geminiApiKey}
              className="w-3 h-3 accent-[#2F81F7]"
            />
            <span className="text-[12px] text-[#EDEDED]">
              Include Gemini API key in the backup
            </span>
            {includeApiKey && (
              <span className="flex items-center gap-1 text-[11px] text-[#D29922]">
                <ShieldAlert className="w-3 h-3" />
                File will contain credentials
              </span>
            )}
          </label>

          <button
            onClick={handleExport}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] transition-colors rounded-sm"
          >
            <Download className="w-3 h-3" />
            <span>Download backup</span>
          </button>
        </div>
      </FieldRow>

      {/* ---------------- IMPORT ---------------- */}
      <FieldRow
        label="Restore"
        hint="Replaces every report, schedule, and setting on this device with the contents of the backup file."
      >
        <div className="space-y-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChosen}
          />

          {!pending && !importError && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-[#EDEDED] bg-transparent hover:bg-[#161616] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors rounded-sm"
            >
              <Upload className="w-3 h-3" />
              <span>Choose backup file…</span>
            </button>
          )}

          {importError && (
            <div className="flex items-start gap-2 p-2 border border-[#3A1414] bg-[#1A0A0A] rounded-sm">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F85149] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#F85149]">{importError}</div>
                <button
                  onClick={() => {
                    setImportError(null);
                    fileInputRef.current?.click();
                  }}
                  className="mt-1.5 text-[11px] text-[#A1A1A1] hover:text-white underline underline-offset-2"
                >
                  Choose a different file
                </button>
              </div>
            </div>
          )}

          {pending && pendingSummary && (
            <div className="border border-[#1F1F1F] bg-[#0F0F0F] rounded-sm overflow-hidden">
              <div className="h-7 flex items-center px-2.5 border-b border-[#1F1F1F] bg-[#0C0C0C]">
                <FileText className="w-3 h-3 text-[#6E6E6E] mr-1.5" />
                <span className="text-[11px] text-[#EDEDED] font-medium">
                  Backup ready to restore
                </span>
                <span className="ml-auto text-[11px] text-[#6E6E6E]">
                  {pendingSummary.exportedAt.replace('T', ' ').slice(0, 16)}
                </span>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                  <span className="text-[#6E6E6E]">Reports</span>
                  <span className="text-[#EDEDED]">{pendingSummary.sessions}</span>
                  <span className="text-[#6E6E6E]">Schedules</span>
                  <span className="text-[#EDEDED]">{pendingSummary.schedules}</span>
                  <span className="text-[#6E6E6E]">Subjects</span>
                  <span className="text-[#EDEDED]">{pendingSummary.mataPraktikumList}</span>
                  <span className="text-[#6E6E6E]">Progress tracked</span>
                  <span className="text-[#EDEDED]">{pendingSummary.manualProgressSubjects} {pendingSummary.manualProgressSubjects === 1 ? 'subject' : 'subjects'}</span>
                  <span className="text-[#6E6E6E]">API key</span>
                  <span className={pendingSummary.hasApiKey ? 'text-[#2EA043]' : 'text-[#A1A1A1]'}>
                    {pendingSummary.hasApiKey ? 'Included' : 'Not included'}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 p-2 border border-[#3A2A14] bg-[#1A1208] rounded-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#D29922] shrink-0" />
                  <span className="text-[12px] text-[#D29922] flex-1">
                    Restoring will replace all reports, schedules, and settings on this device.
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={handleConfirmImport}
                    disabled={isRestoring}
                    className="h-7 px-3 flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#1F4080] disabled:cursor-not-allowed transition-colors rounded-sm"
                  >
                    {isRestoring ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCcw className="w-3 h-3" />
                    )}
                    <span>{isRestoring ? 'Restoring…' : 'Restore and reload'}</span>
                  </button>
                  <button
                    onClick={handleCancelImport}
                    disabled={isRestoring}
                    className="h-7 px-3 text-[12px] text-[#A1A1A1] hover:text-white hover:bg-[#161616] border border-[#2A2A2A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </FieldRow>
    </div>
  );
}

export function OptionsModal() {
  const store = useAppStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Keyboard: Escape closes
  useEffect(() => {
    if (!store.isOptionsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.setOptionsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.isOptionsOpen]);

  // Filename preview values are stable across renders.
  const sampleFilename = useMemo(() => {
    if (!store.globalFileNameFormat) return '\u2014';
    return (
      store.globalFileNameFormat
        .replace(/{nim}/g, '2200018401')
        .replace(/{nama}/g, 'Mohammad Farid Hendianto')
        .replace(/{matkul}/g, 'Penglihatan Komputer')
        .replace(/{pertemuan}/g, '4')
        .replace(/{dosen}/g, 'Dr. Murinto, S.Si., M.Kom.')
        .replace(/{laboratorium}/g, 'Komputasi Dasar') + '.docx'
    );
  }, [store.globalFileNameFormat]);

  if (!store.isOptionsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]">
      <div
        className="bg-[#0A0A0A] w-[920px] max-w-[calc(100vw-32px)] h-[620px] max-h-[calc(100vh-32px)] flex flex-col overflow-hidden border border-[#2A2A2A] rounded-md"
        role="dialog"
        aria-modal="true"
      >
        {/* ---------- TITLE BAR ---------- */}
        <div className="shrink-0 h-10 flex items-center justify-between pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A] select-none">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-[#6E6E6E]" />
            <span className="text-[12px] font-medium text-[#EDEDED]">Preferences</span>
          </div>
          <button
            onClick={() => store.setOptionsOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] rounded-sm"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ---------- BODY ---------- */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[220px] shrink-0 border-r border-[#1F1F1F] bg-[#070707] flex flex-col">
            <div className="h-8 flex items-center px-3 border-b border-[#1F1F1F]">
              <span className="text-[10px] font-medium text-[#6E6E6E]">
                Settings
              </span>
            </div>
            <nav className="flex-1 overflow-y-auto py-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative w-full h-8 pl-3 pr-3 flex items-center gap-2.5 text-[12px] transition-colors outline-none ${
                      active
                        ? 'bg-[#111111] text-[#EDEDED]'
                        : 'text-[#A1A1A1] hover:text-white hover:bg-[#0F0F0F]'
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0 bottom-0 w-[2px] ${
                        active ? 'bg-[#2F81F7]' : 'bg-transparent'
                      }`}
                    />
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 text-left">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="shrink-0 border-t border-[#1F1F1F] p-3">
              <div className="flex items-start gap-1.5 text-[10px] text-[#6E6E6E] leading-snug">
                <ShieldAlert className="w-3 h-3 text-[#6E6E6E] shrink-0 mt-0.5" />
                <span>
                  All preferences are stored locally on this device. Nothing is sent to any server.
                </span>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 flex flex-col bg-[#0A0A0A] min-w-0">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="px-6 py-5">
                {/* ==================== GENERAL ==================== */}
                {activeTab === 'general' && (
                  <div className="max-w-[640px]">
                    <SectionHeader
                      icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                      title="General"
                      description="Base preferences for the Reglab Copilot workspace."
                    />

                    <FieldRow
                      label="Application data"
                      hint="Clear every saved session, schedule, and setting in your browser storage."
                    >
                      <div className="space-y-2.5">
                        <div className="flex flex-col gap-1.5">
                          <label className="flex items-center gap-2 cursor-default">
                            <input
                              type="checkbox"
                              checked
                              disabled
                              className="w-3 h-3 accent-[#2F81F7]"
                            />
                            <span className="text-[11px] text-[#A1A1A1]">
                              Clear IDB / LocalStorage data
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-default">
                            <input
                              type="checkbox"
                              checked
                              disabled
                              className="w-3 h-3 accent-[#2F81F7]"
                            />
                            <span className="text-[11px] text-[#A1A1A1]">
                              Reset Zustand app state
                            </span>
                          </label>
                        </div>

                        {!showConfirm ? (
                          <button
                            onClick={() => setShowConfirm(true)}
                            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-[#EDEDED] bg-transparent hover:bg-[#161616] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors rounded-sm"
                          >
                            <Database className="w-3 h-3" />
                            <span>Clear session storage…</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 p-2 border border-[#3A1414] bg-[#1A0A0A] rounded-sm">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#F85149] shrink-0" />
                            <span className="text-[11px] text-[#F85149] flex-1">
                              This is irreversible.
                            </span>
                            <button
                              onClick={() => {
                                store.clearAllData();
                                setShowConfirm(false);
                              }}
                              className="h-6 px-2.5 text-[11px] font-medium text-white bg-[#F85149] hover:bg-[#DA3633] transition-colors rounded-sm"
                            >
                              Delete all
                            </button>
                            <button
                              onClick={() => setShowConfirm(false)}
                              className="h-6 px-2.5 text-[11px] text-[#A1A1A1] hover:text-white hover:bg-[#161616] border border-[#2A2A2A] transition-colors rounded-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </FieldRow>
                  </div>
                )}

                {/* ==================== MODEL ==================== */}
                {activeTab === 'model' && (
                  <div className="max-w-[640px]">
                    <SectionHeader
                      icon={<Key className="w-3.5 h-3.5" />}
                      title="Model & AI"
                      description="Configure your Gemini credentials. Keys stay on your device only."
                    />

                    <FieldRow
                      label="Gemini API key"
                      hint="Stored locally in your browser. Never transmitted to any server."
                    >
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        className="h-8 w-full bg-[#0F0F0F] border border-[#1F1F1F] hover:border-[#2A2A2A] focus:border-[#2F81F7] focus:outline-none px-2.5 text-[12px] text-[#EDEDED] font-mono rounded-sm placeholder:text-[#4A4A4A]"
                        value={store.geminiApiKey}
                        onChange={(e) => store.setGeminiApiKey(e.target.value)}
                      />
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="text-[#6E6E6E]">Status</span>
                        <span
                          className={`flex items-center gap-1.5 ${
                            store.geminiApiKey ? 'text-[#2EA043]' : 'text-[#D29922]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              store.geminiApiKey ? 'bg-[#2EA043]' : 'bg-[#D29922]'
                            }`}
                          />
                          {store.geminiApiKey ? 'Configured' : 'Not configured'}
                        </span>
                      </div>
                    </FieldRow>
                  </div>
                )}

                {/* ==================== COPILOT ==================== */}
                {activeTab === 'copilot' && <CopilotSettingsSection />}

                {/* ==================== SAVE ==================== */}
                {activeTab === 'save' && (
                  <div className="max-w-[680px]">
                    <SectionHeader
                      icon={<Save className="w-3.5 h-3.5" />}
                      title="Save & Export"
                      description="Default naming convention for exported .docx reports."
                    />

                    <FieldRow
                      label="File name format"
                      hint="Global default. Can be overridden per schedule."
                    >
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="{nim}_{nama}_{pertemuan}_{matkul}"
                            className="flex-1 h-8 bg-[#0F0F0F] border border-[#1F1F1F] hover:border-[#2A2A2A] focus:border-[#2F81F7] focus:outline-none px-2.5 text-[12px] text-[#EDEDED] font-mono rounded-sm placeholder:text-[#4A4A4A]"
                            value={store.globalFileNameFormat}
                            onChange={(e) => store.setGlobalFileNameFormat(e.target.value)}
                          />
                          <button
                            onClick={() =>
                              store.setGlobalFileNameFormat(
                                '{nim}_{nama}_{pertemuan}_{matkul}'
                              )
                            }
                            className="h-8 px-3 text-[11px] text-[#EDEDED] bg-transparent hover:bg-[#161616] border border-[#1F1F1F] hover:border-[#2A2A2A] transition-colors rounded-sm"
                          >
                            Reset
                          </button>
                        </div>

                        {/* Preview */}
                        <div className="bg-[#0F0F0F] border border-[#1F1F1F] rounded-sm">
                          <div className="h-7 flex items-center px-2.5 border-b border-[#1F1F1F]">
                            <FileText className="w-3 h-3 text-[#6E6E6E] mr-1.5" />
                            <span className="text-[11px] text-[#A1A1A1]">Preview</span>
                          </div>
                          <div className="px-2.5 py-2 font-mono text-[12px] text-[#2EA043] break-all">
                            {sampleFilename}
                          </div>
                        </div>

                        {/* Variable reference */}
                        <div>
                          <div className="text-[11px] font-medium text-[#A1A1A1] mb-1.5">
                            Available variables
                          </div>
                          <div className="grid grid-cols-3 gap-px bg-[#1F1F1F] border border-[#1F1F1F] rounded-sm overflow-hidden">
                            {[
                              { token: '{nim}', desc: 'student ID' },
                              { token: '{nama}', desc: 'full name' },
                              { token: '{pertemuan}', desc: 'session #' },
                              { token: '{matkul}', desc: 'subject' },
                              { token: '{dosen}', desc: 'lecturer' },
                              { token: '{laboratorium}', desc: 'laboratory' },
                            ].map((v) => (
                              <div
                                key={v.token}
                                className="bg-[#0A0A0A] px-2.5 py-1.5 flex flex-col"
                              >
                                <code className="font-mono text-[10px] text-[#2F81F7]">
                                  {v.token}
                                </code>
                                <span className="text-[10px] text-[#6E6E6E] mt-0.5">
                                  {v.desc}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </FieldRow>
                  </div>
                )}

                {/* ==================== BACKUP ==================== */}
                {activeTab === 'backup' && <BackupSection />}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- FOOTER ---------- */}
        <div className="shrink-0 h-11 flex items-center justify-between px-3 border-t border-[#1F1F1F] bg-[#070707]">
          <span className="text-[11px] text-[#6E6E6E]">
            Press <kbd className="px-1 text-[10px] text-[#A1A1A1] border border-[#1F1F1F] rounded-sm bg-[#0A0A0A]">Esc</kbd> to close
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => store.setOptionsOpen(false)}
              className="h-7 px-4 text-[11px] text-[#A1A1A1] hover:text-white hover:bg-[#161616] border border-[#1F1F1F] hover:border-[#2A2A2A] transition-colors rounded-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => store.setOptionsOpen(false)}
              className="h-7 px-4 text-[11px] font-medium text-white bg-[#2F81F7] hover:bg-[#2563EB] transition-colors rounded-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
