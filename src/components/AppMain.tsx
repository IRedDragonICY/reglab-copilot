import { useEffect, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAppStore } from '@/lib/store';
import { HomeTab } from '@/components/home-tab';
import { SessionTab } from '@/components/session-tab';
import { OptionsModal } from '@/components/options-modal';
import { Ribbon } from '@/components/ribbon';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  X, FileText, Home, Plus, Download, Settings, Wand2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';


function MenuItem({ label }: { label: string }) {
  return (
    <div className="px-2 py-0.5 text-[#EDEDED] text-[13px] hover:bg-[#1A1A1A] rounded-sm cursor-pointer select-none transition-colors">
      {label}
    </div>
  );
}

function SortableTab({ tab, isActive, onClick, onClose }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative flex items-center gap-2 pl-3 pr-2 h-full cursor-pointer select-none min-w-[160px] max-w-[240px] border-r border-[#1F1F1F] ${
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
            onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`shrink-0 w-4 h-4 flex items-center justify-center hover:bg-[#222222] transition-all rounded-sm ${
            isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-70'
          }`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function AppMain() {
  const { setTheme } = useTheme();
  useEffect(() => setTheme('dark'), [setTheme]);

  const store = useAppStore();
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const activeSession = store.sessions.find((s) => s.id === store.activeTab);
  const isDocView = store.activeTab !== 'home';
  const activeSessionTitle = isDocView
    ? activeSession?.title || 'Untitled Report'
    : '';

  

  // Resize logic for Copilot Sidebar
  const isSidebarVisible = store.isCopilotOpen && isDocView;
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = startXRef.current - e.clientX;
    const newWidth = Math.max(280, Math.min(800, startWidthRef.current + delta));
    setSidebarWidth(newWidth);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const dragHandleProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };

  // Drag and drop for tabs
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = store.openTabs.findIndex((t) => t.id === active.id);
      const newIndex = store.openTabs.findIndex((t) => t.id === over.id);
      store.reorderTabs(arrayMove(store.openTabs, oldIndex, newIndex));
    }
  };

  return (
    <div className="w-full h-screen bg-[#0A0A0A] flex overflow-hidden font-sans text-white">
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* =============================================================
            TOP BAR
        ============================================================= */}
        <header className="shrink-0 flex flex-col w-full border-b border-[#1F1F1F]">
          {/* ---------- Row 1: App title & menus ---------- */}
          <div className="h-10 flex items-center justify-between px-3 relative bg-[#0A0A0A]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 pr-4 border-r border-[#1F1F1F]">
                <div className="w-4 h-4 bg-[#2F81F7] rounded-sm" />
                <span className="font-bold tracking-tight text-[14px]">REGLAB</span>
              </div>
              
              {/* File Menu Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setFileMenuOpen(!fileMenuOpen)}
                  className={`px-2 py-0.5 text-[13px] rounded-sm transition-colors ${
                    fileMenuOpen
                      ? 'bg-[#1C1C1C] text-white'
                      : 'text-[#EDEDED] hover:bg-[#1A1A1A]'
                  }`}
                >
                  File
                </button>
                {fileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setFileMenuOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-56 bg-[#0A0A0A] border border-[#1F1F1F] rounded-md shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        onClick={() => {
                          store.setActiveTab('home');
                          setFileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none"
                      >
                        <Home className="w-3.5 h-3.5 text-[#A1A1A1]" />
                        <span className="flex-1 text-left">Home</span>
                      </button>
                      <button
                        onClick={() => {
                          store.createNewSession();
                          setFileMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#A1A1A1]" />
                        <span className="flex-1 text-left">New Report</span>
                      </button>
                      <div className="my-1 border-t border-[#1F1F1F]" />
                      <button
                        onClick={() => {
                          window.dispatchEvent(new Event('export-docx'));
                          setFileMenuOpen(false);
                        }}
                        disabled={!isDocView}
                        className="w-full flex items-center gap-3 px-3 py-1.5 text-[12px] text-[#EDEDED] hover:bg-[#1C1C1C] outline-none disabled:opacity-50"
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
              
              <MenuItem label="Edit" />
              <MenuItem label="View" />
              <MenuItem label="Insert" />
              <MenuItem label="Format" />
              <MenuItem label="Help" />
            </div>

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
                  className={`flex items-center gap-1.5 px-3 h-6 rounded-sm text-[11px] font-medium transition-colors ${
                    store.isCopilotOpen
                      ? 'bg-[#1C1C1C] text-[#EDEDED] border border-[#2F81F7]/30'
                      : 'bg-[#2F81F7] text-white hover:bg-[#408BF8] border border-transparent'
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  COPILOT
                </button>
              )}
            </div>
          </div>

          {/* ---------- Row 2: Ribbon ---------- */}
          {isDocView && <Ribbon />}

          {/* ---------- Row 3: Tab strip ---------- */}
          <div className="h-9 flex items-end bg-[#0A0A0A]">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max h-9 items-stretch">
                  <SortableContext
                    items={store.openTabs.map((t) => t.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {store.openTabs.map((tab, i) => (
                      <SortableTab
                        key={tab.id}
                        tab={tab}
                        isActive={store.activeTab === tab.id}
                        onClick={() => store.setActiveTab(tab.id)}
                        onClose={() => store.closeTab(tab.id)}
                      />
                    ))}
                  </SortableContext>
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
            </DndContext>
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
            STATUS BAR
        ============================================================= */}
        <footer className="shrink-0 h-6 flex items-center justify-between px-3 bg-[#0A0A0A] border-t border-[#1F1F1F] text-[11px] text-[#6E6E6E]">
          <div className="flex items-center gap-3">
            {store.sessions.length > 0 && (
              <span>
                {store.sessions.length} {store.sessions.length === 1 ? 'report' : 'reports'}
              </span>
            )}
            {activeSession?.metadata?.mataPraktikum && (
              <>
                <span className="text-[#2A2A2A]">·</span>
                <span className="truncate max-w-[260px] text-[#A1A1A1]">
                  {activeSession.metadata.mataPraktikum}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span>Reglab Copilot</span>
          </div>
        </footer>
      </div>

      {isSidebarVisible && (
        <div
          className="shrink-0 flex flex-row relative h-full bg-[#0A0A0A] z-40 border-l border-[#1F1F1F]"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div
            {...dragHandleProps}
            className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 group"
            title="Drag to resize Copilot panel"
          >
            <div
              className={cn(
                'absolute left-1 top-0 bottom-0 w-1 transition-colors duration-100',
                isDragging
                  ? 'bg-[#2F81F7]'
                  : 'bg-transparent group-hover:bg-[#2F81F7]/60 group-hover:delay-100'
              )}
            />
            <div
              className={cn(
                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 transition-opacity duration-100',
                isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:delay-100'
              )}
            >
              <div className="w-0.5 h-0.5 rounded-full bg-[#A1A1A1]" />
              <div className="w-0.5 h-0.5 rounded-full bg-[#A1A1A1]" />
              <div className="w-0.5 h-0.5 rounded-full bg-[#A1A1A1]" />
            </div>
          </div>
          <div id="sidebar-portal-target" className="w-full h-full flex flex-col overflow-hidden" />
        </div>
      )}
      <OptionsModal />
    </div>
  );
}
