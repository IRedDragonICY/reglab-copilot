import { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Sparkles,
  SendHorizonal,
  CheckCircle2,
  Loader2,
  Cpu,
  ChevronDown,
  ChevronRight,
  Code,
  Info,
  User,
  Terminal,
} from 'lucide-react';
import { AIReportData } from '@/lib/types';
import { CopilotMessage, ToolCallState } from '@/hooks/use-copilot-ai';

/* ---------------------------------------------------------------------------
   Tool call block: flat, full-width, bordered. Like an IDE call-stack frame.
--------------------------------------------------------------------------- */
const ToolCallViewer = ({ tool }: { tool: ToolCallState }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col border border-[#1F1F1F] bg-[#0A0A0A] w-full rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-3 h-8 hover:bg-[#111111] transition-colors outline-none w-full text-left"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          {tool.status === 'running' ? (
            <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-[#2EA043] shrink-0" />
          )}
          <Code className="w-3 h-3 text-[#6E6E6E] shrink-0" />
          <span className="text-[11px] truncate">
            <span className="text-[#6E6E6E] mr-1">Tool</span>
            <span className="text-[#2F81F7] font-medium font-mono">{tool.name}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#6E6E6E]">
            {tool.status === 'running' ? 'Running' : 'Completed'}
          </span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-[#6E6E6E]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#6E6E6E]" />
          )}
        </div>
      </button>

      {expanded && tool.args && (
        <div className="border-t border-[#1F1F1F] bg-[#050505]">
          <pre className="text-[11px] font-mono text-[#A1A1A1] overflow-x-auto whitespace-pre-wrap max-h-[300px] custom-scrollbar p-3 leading-relaxed">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Agent message: header row (role + timestamp) → optional thought log →
   tool frames → text block. Full-width, no bubbles.
--------------------------------------------------------------------------- */
const AgentMessage = ({ msg, statusText }: { msg: CopilotMessage; statusText: string }) => {
  const [showThought, setShowThought] = useState(msg.isThinking);
  const thoughtEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msg.isThinking) setShowThought(true);
    else if (!msg.isThinking && msg.thought) setShowThought(false);
  }, [msg.isThinking, msg.thought]);

  useEffect(() => {
    if (showThought && thoughtEndRef.current) {
      thoughtEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [msg.thought, showThought]);

  const showThoughtBox = msg.thought || msg.isThinking;

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Header — agent identity + live status */}
      <div className="flex items-center gap-2 h-5">
        <div className="w-4 h-4 flex items-center justify-center bg-[#0F1A2E] border border-[#1F3A66] rounded-sm">
          <Sparkles className="w-2.5 h-2.5 text-[#2F81F7]" />
        </div>
        <span className="text-[11px] font-medium text-[#EDEDED]">Copilot</span>
        {msg.isThinking && (
          <span className="text-[11px] text-[#6E6E6E] pl-2 border-l border-[#1F1F1F] ml-1">
            Thinking
          </span>
        )}
      </div>

      {/* Reasoning trace */}
      {showThoughtBox && (
        <div className="border border-[#1F1F1F] bg-[#0A0A0A] rounded-sm overflow-hidden">
          <button
            onClick={() => setShowThought(!showThought)}
            className="flex items-center justify-between px-3 h-7 w-full hover:bg-[#111111] transition-colors outline-none"
          >
            <div className="flex items-center gap-2">
              {msg.isThinking ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#2F81F7]" />
              ) : (
                <Cpu className="w-3 h-3 text-[#6E6E6E]" />
              )}
              <span
                className={`text-[11px] ${
                  msg.isThinking ? 'text-[#2F81F7] font-medium' : 'text-[#A1A1A1]'
                }`}
              >
                {msg.isThinking ? statusText || 'Analyzing context' : 'Reasoning'}
              </span>
            </div>
            {showThought ? (
              <ChevronDown className="w-3 h-3 text-[#6E6E6E]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#6E6E6E]" />
            )}
          </button>

          {showThought && (
            <div className="border-t border-[#1F1F1F] bg-[#050505]">
              <div className="px-3 py-2.5 font-mono text-[11px] text-[#A1A1A1] whitespace-pre-wrap leading-[1.55] max-h-[300px] overflow-y-auto custom-scrollbar">
                {msg.thought ? (
                  msg.thought
                ) : (
                  <span className="text-[#6E6E6E] animate-pulse">
                    Waiting for model output…
                  </span>
                )}
                <div ref={thoughtEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tool frames */}
      {msg.tools && msg.tools.length > 0 && (
        <div className="flex flex-col gap-1 w-full">
          {msg.tools.map((tool, idx) => (
            <ToolCallViewer key={idx} tool={tool} />
          ))}
        </div>
      )}

      {/* Final text — flat block, no bubble */}
      {msg.text && (
        <div className="border-l-2 border-[#2F81F7] pl-3 pr-1 py-1 text-[13px] leading-relaxed text-[#EDEDED] whitespace-pre-wrap">
          {msg.text}
        </div>
      )}
    </div>
  );
};

/* --------------------------------------------------------------------------- */

interface CopilotPanelProps {
  chatHistory: CopilotMessage[];
  isGenerating: boolean;
  statusText: string;
  selectedModelName: string;
  setSelectedModelName: (val: string) => void;
  availableModels: any[];
  handleGenerate: () => void;
  aiPreviewData: AIReportData | null;
  chatInput: string;
  setChatInput: (val: string) => void;
  handleCompileEdit: () => void;
}

export function CopilotPanel({
  chatHistory,
  isGenerating,
  statusText,
  selectedModelName,
  setSelectedModelName,
  availableModels,
  handleGenerate,
  aiPreviewData,
  chatInput,
  setChatInput,
  handleCompileEdit,
}: CopilotPanelProps) {
  const lastMessage = chatHistory[chatHistory.length - 1];
  const isAgentThinking = lastMessage?.role === 'agent' && lastMessage?.isThinking === true;
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isGenerating, statusText]);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] overflow-hidden">
      {/* ================= THREAD ================= */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar scroll-smooth"
      >
        {chatHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center">
            <div className="w-10 h-10 flex items-center justify-center border border-[#1F1F1F] mb-4 rounded-sm">
              <Terminal className="w-4 h-4 text-[#4A4A4A]" />
            </div>
            <p className="text-[12px] text-[#EDEDED] font-medium">Copilot is ready</p>
            <p className="text-[11px] text-[#6E6E6E] mt-1 max-w-[260px]">
              Generate a report or send a message to start the conversation.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {chatHistory.map((m, i) => {
              const k = m.id ?? `${m.role}-${i}`;
              if (m.role === 'user') {
                return (
                  <div key={k} className="px-4 py-3 hover:bg-[#0C0C0C] transition-colors">
                    <div className="flex items-center gap-2 h-5 mb-1.5">
                      <div className="w-4 h-4 flex items-center justify-center bg-[#161616] border border-[#2A2A2A] rounded-sm">
                        <User className="w-2.5 h-2.5 text-[#A1A1A1]" />
                      </div>
                      <span className="text-[11px] font-medium text-[#EDEDED]">You</span>
                    </div>
                    <div className="pl-6 text-[13px] leading-relaxed text-[#EDEDED] whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                );
              }

              if (m.role === 'system') {
                return (
                  <div
                    key={k}
                    className="px-4 py-2.5 bg-[#0C0C0C] flex items-start gap-2 text-[11px] text-[#A1A1A1]"
                  >
                    <Info className="w-3 h-3 text-[#6E6E6E] shrink-0 mt-0.5" />
                    <span className="leading-relaxed break-words">{m.text}</span>
                  </div>
                );
              }

              return (
                <div key={k} className="px-4 py-3 hover:bg-[#0C0C0C] transition-colors">
                  <AgentMessage msg={m} statusText={statusText} />
                </div>
              );
            })}

            {isGenerating && !isAgentThinking && (
              <div className="px-4 py-2.5 flex items-center gap-2 text-[11px] text-[#A1A1A1] bg-[#0C0C0C]">
                <Loader2 className="w-3 h-3 text-[#2F81F7] animate-spin" />
                <span>{statusText}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= COMPOSER ================= */}
      <div className="shrink-0 border-t border-[#1F1F1F] bg-[#0A0A0A]">
        {/* Status/model bar */}
        <div className="h-7 flex items-center justify-between px-3 border-b border-[#1F1F1F] bg-[#0A0A0A]">
          <Select value={selectedModelName} onValueChange={(v) => v && setSelectedModelName(v)}>
            <SelectTrigger className="h-6 bg-transparent border-none shadow-none focus:ring-0 focus:border-none focus-visible:ring-0 focus-visible:border-none px-1 text-[10px] font-mono text-[#A1A1A1] hover:text-white gap-1 rounded-sm">
              <Sparkles className="w-2.5 h-2.5 text-[#2F81F7] shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0F0F0F] border border-[#1F1F1F] text-[#EDEDED] min-w-[260px] rounded-sm p-0 shadow-none">
              <div className="px-3 py-1.5 text-[9px] font-medium tracking-[0.14em] text-[#6E6E6E] uppercase border-b border-[#1F1F1F]">
                Model selection
              </div>
              {availableModels.map((m) => (
                <SelectItem
                  key={m.name}
                  value={m.name}
                  className="focus:bg-[#161616] focus:text-white cursor-pointer px-3 py-2 text-[11px] rounded-none mx-0 my-0 border-b border-[#141414] last:border-0 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{m.name}</span>
                      {m.new && (
                        <span className="font-mono text-[8px] tracking-[0.14em] uppercase border border-[#1F3A66] bg-[#0F1A2E] text-[#2F81F7] px-1">
                          new
                        </span>
                      )}
                    </div>
                    {m.info && (
                      <div className="text-[10px] text-[#6E6E6E] font-mono">{m.info}</div>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="flex items-center gap-1.5 text-[11px] text-[#A1A1A1]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isGenerating ? 'bg-[#D29922] animate-pulse' : 'bg-[#2EA043]'
              }`}
            />
            {isGenerating ? 'Generating' : 'Ready'}
          </span>
        </div>

        {/* Primary action button */}
        <div className="px-3 pt-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full h-9 flex items-center justify-center gap-2 bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#161616] disabled:text-[#4A4A4A] disabled:cursor-not-allowed text-white font-medium transition-colors rounded-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[12px] tracking-wide uppercase">
              {aiPreviewData ? 'Regenerate Analysis' : 'Generate Initial Report'}
            </span>
          </button>
        </div>

        {/* Composer */}
        <div className="p-3 pt-2">
          <div className="relative border border-[#1F1F1F] focus-within:border-[#2F81F7] bg-[#0A0A0A] rounded-sm transition-colors">
            <div className="flex items-center h-6 px-2.5 border-b border-[#1F1F1F] bg-[#0C0C0C]">
              <span className="text-[10px] font-medium text-[#A1A1A1]">
                {aiPreviewData ? 'Edit instructions' : 'Message Copilot'}
              </span>
              <span className="ml-auto text-[10px] text-[#6E6E6E]">
                ⏎ to send · ⇧⏎ for newline
              </span>
            </div>
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (aiPreviewData) handleCompileEdit();
                  else handleGenerate();
                }
              }}
              placeholder={
                aiPreviewData
                  ? 'Ask Copilot to edit specific parts…'
                  : 'Generate a report first to edit…'
              }
              disabled={isGenerating}
              className="resize-none min-h-[72px] max-h-[180px] bg-transparent border-none text-[#EDEDED] focus-visible:ring-0 focus-visible:border-none rounded-none pl-3 pr-11 py-2.5 text-[13px] leading-relaxed transition-all custom-scrollbar placeholder:text-[#4A4A4A]"
            />
            <button
              onClick={() => {
                if (aiPreviewData) handleCompileEdit();
                else handleGenerate();
              }}
              disabled={isGenerating || !chatInput.trim()}
              title="Send"
              className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-[#2F81F7] hover:bg-[#2563EB] disabled:bg-[#161616] disabled:text-[#4A4A4A] disabled:cursor-not-allowed text-white transition-colors rounded-sm"
            >
              <SendHorizonal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
