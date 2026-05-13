import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  X, Settings, Save, Key, SlidersHorizontal, Database, FileText, AlertTriangle
} from 'lucide-react';

/* ---------------------------------------------------------------------------
   Flat pro-app preferences modal. Crisp 1px borders, no shadows, no pills.
--------------------------------------------------------------------------- */

type TabId = 'general' | 'model' | 'save';

const TABS: { id: TabId; label: string; icon: React.ComponentType<any>; hint: string }[] = [
  { id: 'general', label: 'General',  icon: SlidersHorizontal, hint: '⌘1' },
  { id: 'model',   label: 'Model',    icon: Key,               hint: '⌘2' },
  { id: 'save',    label: 'Save',     icon: Save,              hint: '⌘3' },
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
        <h3 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#EDEDED]">
          {title}
        </h3>
      </div>
      {description && (
        <p className="mt-1.5 text-[11px] text-[#A1A1A1] leading-relaxed">{description}</p>
      )}
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
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#EDEDED]">
              Preferences
            </span>
            <span className="font-mono text-[10px] text-[#6E6E6E] pl-2 border-l border-[#1F1F1F] ml-1">
              reglab.config
            </span>
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
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6E6E6E]">
                Sections
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
                    <span className="font-mono text-[9px] text-[#6E6E6E]">{tab.hint}</span>
                  </button>
                );
              })}
            </nav>
            <div className="shrink-0 border-t border-[#1F1F1F] p-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#4A4A4A] leading-relaxed">
                // local-only
                <br />
                // never leaves device
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
                      <div className="mt-2 flex items-center gap-2 font-mono text-[10px]">
                        <span className="uppercase tracking-[0.14em] text-[#6E6E6E]">status</span>
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
                          {store.geminiApiKey ? 'configured' : 'not configured'}
                        </span>
                      </div>
                    </FieldRow>
                  </div>
                )}

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
                          <div className="h-6 flex items-center px-2.5 border-b border-[#1F1F1F]">
                            <FileText className="w-2.5 h-2.5 text-[#6E6E6E] mr-1.5" />
                            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#6E6E6E]">
                              preview
                            </span>
                          </div>
                          <div className="px-2.5 py-2 font-mono text-[11px] text-[#2EA043] break-all">
                            {store.globalFileNameFormat
                              ? store.globalFileNameFormat
                                  .replace(/{nim}/g, '2200018401')
                                  .replace(/{nama}/g, 'Mohammad Farid Hendianto')
                                  .replace(/{matkul}/g, 'Penglihatan Komputer')
                                  .replace(/{pertemuan}/g, '4')
                                  .replace(/{dosen}/g, 'Dr. Murinto, S.Si., M.Kom.')
                                  .replace(/{laboratorium}/g, 'Komputasi Dasar') + '.docx'
                              : '\u2014'}
                          </div>
                        </div>

                        {/* Variable reference */}
                        <div>
                          <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E] mb-1.5">
                            Variables
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
              </div>
            </div>
          </div>
        </div>

        {/* ---------- FOOTER ---------- */}
        <div className="shrink-0 h-11 flex items-center justify-between px-3 border-t border-[#1F1F1F] bg-[#070707]">
          <div className="font-mono text-[10px] text-[#6E6E6E]">
            <span className="uppercase tracking-[0.14em]">esc</span>
            <span className="mx-1">·</span>
            <span>close</span>
          </div>
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
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
