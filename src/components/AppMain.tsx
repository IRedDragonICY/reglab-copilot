import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';
import { HomeTab } from '@/components/home-tab';
import { SessionTab } from '@/components/session-tab';
import { OptionsModal } from '@/components/options-modal';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  X, FileText, Home, Clipboard, Brush, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, Plus, Download, Settings, Wand2,
  Bold, Italic, Underline, Strikethrough, Type, Minus
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

/* ---------------------------------------------------------------------------
   Flat IDE-style toolbar primitives. No shadows, crisp 1px borders, mono chrome.
--------------------------------------------------------------------------- */

function MenuItem({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-2.5 text-[12px] text-[#A1A1A1] hover:text-white hover:bg-[#161616] transition-colors outline-none rounded-sm"
    >
      {label}
    </button>
  );
}

function RibbonIconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={[
        'h-7 w-7 flex items-center justify-center transition-colors rounded-sm',
        active
          ? 'bg-[#1F1F1F] text-white border border-[#2A2A2A]'
          : 'text-[#A1A1A1] hover:text-white hover:bg-[#161616] border border-transparent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function RibbonDivider() {
  return <div className="h-6 w-px bg-[#1F1F1F] mx-1.5" />;
}

function RibbonGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

/* --------------------------------------------------------------------------- */

export default function AppMain() {
  const store = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const fileBtnRef = useRef<HTMLDivElement>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setTheme('dark');
  }, [setTheme]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0A0A0A] text-[#6E6E6E] text-xs font-mono">
        <span className="tracking-wider uppercase">Initializing Reglab Copilot…</span>
      </div>
    );
  }

  const activeSession = store.sessions.find((s) => s.id === store.activeTab);
  const activeSessionTitle =
    store.activeTab === 'home' ? 'Home' : activeSession?.title || 'Untitled';

  const isDocView = store.activeTab !== 'home';

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0A0A] text-[#EDEDED] overflow-hidden">
      {/* =============================================================
          HEADER: stacked menu → ribbon → tab strip (IDE style)
      ============================================================= */}
      <header className="shrink-0 flex flex-col bg-[#0A0A0A] border-b border-[#1F1F1F] z-20 select-none">
        {/* ---------- Row 1: Menu bar (always visible) ---------- */}
        <div className="h-9 flex items-center justify-between px-2 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-0.5">
            {/* App mark */}
            <div className="flex items-center gap-2 pl-1 pr-3 border-r border-[#1A1A1A] mr-1 h-6">
              <div className="w-4 h-4 bg-[#2F81F7] rounded-[1px]" />
              <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#EDEDED]">
                Reglab
              </span>
            </div>

            {/* File menu */}
            <div className="relative" ref={fileBtnRef}>
              <button
                onClick={() => {
                  setFileMenuOpen((v) => !v);
                  setEditMenuOpen(false);
                  setViewMenuOpen(false);
                }}
                className={`h-7 px-2.5 text-[12px] transition-colors outline-none rounded-sm ${
                  fileMenuOpen
                    ? 'bg-[#161616] text-white'
                    : 'text-[#A1A1A1] hover:text-white hover:bg-[#161616]'
                }`}
              >
                File
              </button>
              {fileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setFileMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-60 bg-[#111111] border border-[#222222] rounded-sm py-1 z-50">
                    <div className="px-3 pb-1.5 pt-1 text-[10px] font-medium tracking-[0.14em] uppercase text-[#6E6E6E]">
                      File
                    </div>
                    <button
                      onClick={() => {
                        store.createNewSession();
                        setFileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#A1A1A1]" />
                      <span className="flex-1 text-left">New Report</span>
                      <span className="font-mono text-[10px] text-[#6E6E6E]">⌘N</span>
                    </button>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('export-active-session'));
                        setFileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none"
                    >
                      <Download className="w-3.5 h-3.5 text-[#A1A1A1]" />
                      <span className="flex-1 text-left">Export as .docx</span>
                      <span className="font-mono text-[10px] text-[#6E6E6E]">⌘S</span>
                    </button>
                    <div className="my-1 border-t border-[#1F1F1F]" />
                    <button
                      onClick={() => {
                        store.setOptionsOpen(true);
                        setFileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#A1A1A1]" />
                      <span className="flex-1 text-left">Preferences…</span>
                      <span className="font-mono text-[10px] text-[#6E6E6E]">⌘,</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Static menu items (non-functional, for visual parity with IDEs) */}
            <MenuItem label="Edit" />
            <MenuItem label="View" />
            <MenuItem label="Insert" />
            <MenuItem label="Format" />
            <MenuItem label="Help" />
          </div>

          {/* Right: document title + copilot toggle */}
          <div className="flex items-center gap-2 pr-1">
            <div className="hidden md:flex items-center gap-2 px-2 h-6 border border-[#1F1F1F] rounded-sm bg-[#0F0F0F]">
              <FileText className="w-3 h-3 text-[#6E6E6E]" />
              <span className="font-mono text-[11px] text-[#A1A1A1] truncate max-w-[280px]">
                {activeSessionTitle}
              </span>
            </div>
            {isDocView && (
              <button
                onClick={() => store.toggleCopilot()}
                className={`h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-medium transition-colors rounded-sm border ${
                  store.isCopilotOpen
                    ? 'bg-[#0F1A2E] border-[#1F3A66] text-[#2F81F7]'
                    : 'bg-transparent border-[#1F1F1F] text-[#A1A1A1] hover:text-white hover:bg-[#161616]'
                }`}
                title="Toggle Copilot Panel"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span className="tracking-wide uppercase">Copilot</span>
              </button>
            )}
          </div>
        </div>

        {/* ---------- Row 2: Ribbon (only in doc view) ---------- */}
        {isDocView && (
          <div className="h-10 flex items-center px-2 border-b border-[#1A1A1A] bg-[#0C0C0C] overflow-x-auto">
            <RibbonGroup>
              <RibbonIconBtn title="Paste">
                <Clipboard className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn title="Format Painter">
                <Brush className="w-3.5 h-3.5" />
              </RibbonIconBtn>
            </RibbonGroup>

            <RibbonDivider />

            {/* Font family + size — native <select> styled flat */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <select
                  onChange={(e) => document.execCommand('fontName', false, e.target.value)}
                  defaultValue="Aptos"
                  className="h-7 pl-2 pr-6 appearance-none bg-[#111111] border border-[#1F1F1F] hover:border-[#2A2A2A] text-[11px] text-[#EDEDED] font-mono outline-none cursor-pointer rounded-sm w-36 focus:border-[#2F81F7]"
                >
                  <option value="Aptos">Aptos</option>
                  <option value="Inter">Inter</option>
                  <option value="Arial">Arial</option>
                  <option value="Calibri">Calibri</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Geist">Geist</option>
                </select>
                <Type className="w-3 h-3 text-[#6E6E6E] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  onChange={(e) => document.execCommand('fontSize', false, e.target.value)}
                  defaultValue="3"
                  className="h-7 pl-2 pr-5 appearance-none bg-[#111111] border border-[#1F1F1F] hover:border-[#2A2A2A] text-[11px] text-[#EDEDED] font-mono outline-none cursor-pointer rounded-sm w-14 focus:border-[#2F81F7]"
                >
                  <option value="1">8</option>
                  <option value="2">10</option>
                  <option value="3">12</option>
                  <option value="4">14</option>
                  <option value="5">18</option>
                  <option value="6">24</option>
                  <option value="7">36</option>
                </select>
              </div>
            </div>

            <RibbonDivider />

            <RibbonGroup>
              <RibbonIconBtn title="Bold" onClick={() => document.execCommand('bold', false)}>
                <Bold className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn title="Italic" onClick={() => document.execCommand('italic', false)}>
                <Italic className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Underline"
                onClick={() => document.execCommand('underline', false)}
              >
                <Underline className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Strikethrough"
                onClick={() => document.execCommand('strikeThrough', false)}
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </RibbonIconBtn>
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup>
              <label
                className="h-7 w-7 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer relative rounded-sm"
                title="Text Color"
              >
                <span className="text-[11px] font-bold leading-none" style={{ borderBottom: '2px solid #F85149' }}>
                  A
                </span>
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                />
              </label>
              <label
                className="h-7 w-7 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer relative rounded-sm"
                title="Highlight"
              >
                <Brush
                  className="w-3.5 h-3.5"
                  style={{ borderBottom: '2px solid #D29922' }}
                />
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => document.execCommand('hiliteColor', false, e.target.value)}
                />
              </label>
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup>
              <RibbonIconBtn
                title="Align Left"
                onClick={() => document.execCommand('justifyLeft', false)}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Align Center"
                onClick={() => document.execCommand('justifyCenter', false)}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Align Right"
                onClick={() => document.execCommand('justifyRight', false)}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Justify"
                onClick={() => document.execCommand('justifyFull', false)}
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </RibbonIconBtn>
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup>
              <RibbonIconBtn
                title="Bulleted List"
                onClick={() => document.execCommand('insertUnorderedList', false)}
              >
                <List className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Numbered List"
                onClick={() => document.execCommand('insertOrderedList', false)}
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Outdent"
                onClick={() => document.execCommand('outdent', false)}
              >
                <Outdent className="w-3.5 h-3.5" />
              </RibbonIconBtn>
              <RibbonIconBtn
                title="Indent"
                onClick={() => document.execCommand('indent', false)}
              >
                <Indent className="w-3.5 h-3.5" />
              </RibbonIconBtn>
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup>
              <RibbonIconBtn
                title="Horizontal Rule"
                onClick={() => document.execCommand('insertHorizontalRule', false)}
              >
                <Minus className="w-3.5 h-3.5" />
              </RibbonIconBtn>
            </RibbonGroup>
          </div>
        )}

        {/* ---------- Row 3: Tab strip ---------- */}
        <div className="h-9 flex items-end bg-[#0A0A0A]">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max h-9 items-stretch">
              {store.openTabs.map((tab, i) => {
                const isActive = store.activeTab === tab.id;
                return (
                  <div
                    key={tab.id}
                    onClick={() => store.setActiveTab(tab.id)}
                    className={`group relative flex items-center gap-2 pl-3 pr-2 h-full cursor-pointer select-none min-w-[160px] max-w-[240px] border-r border-[#1F1F1F] ${
                      i === 0 ? 'border-l border-[#1F1F1F]' : ''
                    } ${
                      isActive
                        ? 'bg-[#0A0A0A] text-[#EDEDED]'
                        : 'bg-[#0C0C0C] text-[#888888] hover:bg-[#111111] hover:text-[#CCCCCC]'
                    }`}
                  >
                    {/* Active top accent */}
                    <span
                      className={`absolute top-0 left-0 right-0 h-[2px] ${
                        isActive ? 'bg-[#2F81F7]' : 'bg-transparent'
                      }`}
                    />
                    {tab.type === 'home' ? (
                      <Home className="w-3.5 h-3.5 shrink-0 text-[#A1A1A1]" />
                    ) : (
                      <FileText
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isActive ? 'text-[#2F81F7]' : 'text-[#6E6E6E]'
                        }`}
                      />
                    )}
                    <span className="font-mono text-[11px] truncate flex-1">{tab.title}</span>
                    {tab.type !== 'home' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          store.closeTab(tab.id);
                        }}
                        className={`shrink-0 w-4 h-4 flex items-center justify-center hover:bg-[#222222] transition-all rounded-sm ${
                          isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => store.createNewSession()}
                title="New Report"
                className="w-9 h-full flex items-center justify-center text-[#6E6E6E] hover:text-white hover:bg-[#111111] border-r border-[#1F1F1F] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 border-b border-[#1F1F1F]" />
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      </header>

      {/* =============================================================
          MAIN
      ============================================================= */}
      <main className="flex-1 overflow-hidden relative flex bg-[#0A0A0A]">
        <div
          className={`flex-1 p-3 overflow-hidden ${
            store.activeTab === 'home' ? 'block' : 'hidden'
          }`}
        >
          <HomeTab />
        </div>
        {isDocView && <SessionTab key={store.activeTab} sessionId={store.activeTab} />}
      </main>

      {/* =============================================================
          STATUS BAR (IDE footer)
      ============================================================= */}
      <footer className="shrink-0 h-6 flex items-center justify-between px-3 bg-[#0A0A0A] border-t border-[#1F1F1F] text-[10px] font-mono text-[#6E6E6E]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#2EA043] rounded-full" />
            READY
          </span>
          <span>{store.sessions.length} session{store.sessions.length === 1 ? '' : 's'}</span>
          {activeSession?.metadata?.mataPraktikum && (
            <span className="truncate max-w-[240px]">
              {activeSession.metadata.mataPraktikum}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>UTF-8</span>
          <span>LF</span>
          <span className="uppercase tracking-wider">Reglab Copilot v1</span>
        </div>
      </footer>

      <OptionsModal />
    </div>
  );
}
