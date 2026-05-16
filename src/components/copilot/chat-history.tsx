/**
 * Per-report chat history drawer.
 *
 * Lists the archived chat threads for the **current report only**,
 * never threads from other reports — same model as Cursor's
 * per-project chat list. Threads are archived from the live
 * `chatHistory` whenever the user clicks "New chat" or opens
 * another archived thread.
 *
 * Click a thread → re-open it (the current live thread is archived
 * first so nothing is ever lost). Hover a row → trash icon to
 * permanently delete that thread.
 */

import { useMemo, useState } from 'react';
import { History, MessagesSquare, Search, Trash2, X } from 'lucide-react';
import type { ChatThread } from '@/lib/copilot/types';
import { cn } from '@/lib/utils';

export interface ChatHistoryProps {
  threads: ChatThread[];
  onOpenThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onClose?: () => void;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function ChatHistory(props: ChatHistoryProps) {
  const { threads, onOpenThread, onDeleteThread, onClose } = props;
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Newest first, filtered by query against the title and the first
  // message text so users can recall a thread by either.
  const ordered = useMemo(() => {
    const sorted = [...threads].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => {
      if ((t.title ?? '').toLowerCase().includes(q)) return true;
      const firstUser = t.messages.find((m) => m.role === 'user');
      return (firstUser?.text ?? '').toLowerCase().includes(q);
    });
  }, [threads, query]);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] border-l border-[#1F1F1F] w-[360px]">
      {/* Header */}
      <div className="shrink-0 h-9 flex items-center justify-between pl-3 pr-1 border-b border-[#1F1F1F] bg-[#0A0A0A] select-none">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-[#6E6E6E]" />
          <span className="text-[12px] font-medium text-[#EDEDED]">Chat history</span>
          <span className="text-[11px] text-[#6E6E6E] font-mono">{threads.length}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={!onClose}
          className="w-7 h-7 inline-flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] disabled:opacity-50 rounded-sm"
          title="Close history"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2 py-2 border-b border-[#1F1F1F] bg-[#0A0A0A]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#6E6E6E] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search past chats…"
            className="w-full h-7 pl-7 pr-2 bg-[#0F0F0F] border border-[#1F1F1F] focus:border-[#2F81F7] outline-none text-[11px] text-[#EDEDED] placeholder:text-[#4A4A4A] rounded-sm transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-10 h-10 flex items-center justify-center border border-[#1F1F1F] mb-3 rounded-sm">
              <MessagesSquare className="w-4 h-4 text-[#4A4A4A]" />
            </div>
            <p className="text-[12px] text-[#EDEDED] font-medium">
              {query ? 'No matches' : 'No archived chats'}
            </p>
            <p className="text-[11px] text-[#6E6E6E] mt-1 max-w-[240px]">
              {query
                ? 'Try a different search term.'
                : 'Click + to start a new chat — your previous threads will be saved here.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1A1A1A]">
            {ordered.map((t) => {
              const subtitle =
                t.messages.find((m) => m.role === 'user')?.text?.slice(0, 80) ?? '—';
              const messageCount = t.messages.length;
              const isPending = pendingDelete === t.id;
              return (
                <li key={t.id}>
                  <div
                    className={cn(
                      'group cursor-pointer px-3 py-2.5 transition-colors outline-none border-l-2 border-l-transparent',
                      'hover:bg-[#0C0C0C]',
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenThread(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onOpenThread(t.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <MessagesSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#6E6E6E]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-[#EDEDED] font-medium truncate">
                          {t.title || 'Untitled chat'}
                        </div>
                        <div className="text-[11px] text-[#A1A1A1] truncate mt-0.5">
                          {subtitle}
                        </div>
                        <div className="text-[10px] text-[#6E6E6E] font-mono mt-0.5 flex items-center gap-1.5">
                          <span>{formatTimestamp(t.updatedAt ?? t.createdAt ?? Date.now())}</span>
                          <span className="text-[#2F2F2F]">·</span>
                          <span>{messageCount} msgs</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPending) {
                            onDeleteThread(t.id);
                            setPendingDelete(null);
                          } else {
                            setPendingDelete(t.id);
                            setTimeout(() => {
                              setPendingDelete((cur) => (cur === t.id ? null : cur));
                            }, 2500);
                          }
                        }}
                        title={isPending ? 'Click again to confirm' : 'Delete thread'}
                        className={cn(
                          'shrink-0 w-6 h-6 inline-flex items-center justify-center rounded-sm transition-colors',
                          isPending
                            ? 'bg-[#1A0808] text-[#F85149]'
                            : 'text-[#4A4A4A] opacity-0 group-hover:opacity-100 hover:text-[#F85149] hover:bg-[#1A0808]',
                        )}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ChatHistory;
