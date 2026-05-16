/**
 * Copilot settings section (task 14.1).
 *
 * Renders inside the existing Preferences modal as a new "Copilot"
 * row group, exposing the four `copilotSettings` controls from
 * `useAppStore`:
 *
 *   - Auto-accept AI changes (toggle, default ON)
 *   - Google Search grounding (toggle, default OFF)
 *   - Code execution (toggle, default OFF)
 *   - Maximum agent iterations (slider, [1, 30], default 15)
 *
 * The component never reads/writes `copilotSettings` directly — every
 * mutation flows through `setCopilotSettings`, which centralizes the
 * `maxIterations` clamp inside the store (Req 10.1, 10.4). Toggling
 * `Auto-accept AI changes` to OFF takes effect on the next merge per
 * Req 10.3; in-flight pending merges are unaffected.
 *
 * Visual conventions follow the modal's existing palette — `#0F0F0F`
 * inputs, `#1F1F1F` borders, `#2F81F7` accent, `text-[12px]` body.
 */

import { useId } from 'react';
import { useAppStore } from '@/lib/store';
import type { CopilotSettings } from '@/lib/copilot/types';

const MIN_ITER = 1;
const MAX_ITER = 30;

interface ToggleRowProps {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

/**
 * One toggle row matching the modal's `FieldRow` two-column layout.
 * Local component so this section file is self-contained — the
 * existing `FieldRow` lives inside `options-modal.tsx` and isn't
 * exported.
 */
function ToggleRow({ label, hint, checked, onChange }: ToggleRowProps) {
  const id = useId();
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-3 border-b border-[#141414] last:border-0">
      <div className="pt-1">
        <label htmlFor={id} className="text-[12px] font-medium text-[#EDEDED] cursor-pointer">
          {label}
        </label>
        <div className="text-[11px] text-[#6E6E6E] mt-0.5 leading-snug">{hint}</div>
      </div>
      <div className="min-w-0 flex items-center gap-2 pt-1">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-3 h-3 accent-[#2F81F7] cursor-pointer"
        />
        <span className="text-[11px] text-[#A1A1A1] select-none">
          {checked ? 'On' : 'Off'}
        </span>
      </div>
    </div>
  );
}

export function CopilotSettingsSection() {
  // Subscribe slice-level so a sibling tab toggling autoAccept doesn't
  // re-render the rest of the modal.
  const settings = useAppStore((s) => s.copilotSettings);
  const setCopilotSettings = useAppStore((s) => s.setCopilotSettings);

  const update = <K extends keyof CopilotSettings>(key: K, value: CopilotSettings[K]) => {
    setCopilotSettings({ [key]: value } as Partial<CopilotSettings>);
  };

  return (
    <div className="max-w-[640px]">
      <div className="pb-4 mb-2 border-b border-[#1F1F1F]">
        <h3 className="text-[14px] font-semibold text-[#EDEDED]">Copilot</h3>
        <p className="mt-1.5 text-[12px] text-[#A1A1A1] leading-relaxed">
          Tune the agent loop for your workflow. Toggles take effect on the next agent run; in-flight
          merges are unaffected.
        </p>
      </div>

      <ToggleRow
        label="Auto-accept AI changes"
        hint="When off, the agent pauses on every merge so you can review hunks in the diff view before applying."
        checked={settings.autoAccept}
        onChange={(v) => update('autoAccept', v)}
      />

      <ToggleRow
        label="Google Search grounding"
        hint="Adds Gemini's built-in web search tool. The agent may cite sources in the chat thread."
        checked={settings.googleSearch}
        onChange={(v) => update('googleSearch', v)}
      />

      <ToggleRow
        label="Code execution"
        hint="Adds Gemini's built-in Python sandbox. Use for verification-heavy tasks; increases token cost."
        checked={settings.codeExecution}
        onChange={(v) => update('codeExecution', v)}
      />

      {/* Iteration slider — uses the same FieldRow-style two-column layout
          as the toggle rows but renders a range input instead of a checkbox. */}
      <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-3 border-b border-[#141414] last:border-0">
        <div className="pt-1">
          <div className="text-[12px] font-medium text-[#EDEDED]">Maximum agent iterations</div>
          <div className="text-[11px] text-[#6E6E6E] mt-0.5 leading-snug">
            Hard cap on the agent's tool-call loop. Higher values give the agent more room to
            self-correct; lower values bound runaway costs.
          </div>
        </div>
        <div className="min-w-0 flex flex-col gap-1.5 pt-1">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_ITER}
              max={MAX_ITER}
              step={1}
              value={settings.maxIterations}
              onChange={(e) => update('maxIterations', Number(e.target.value))}
              className="flex-1 accent-[#2F81F7] cursor-pointer"
              aria-label="Maximum agent iterations"
            />
            <span className="font-mono text-[12px] text-[#EDEDED] w-8 text-right tabular-nums">
              {settings.maxIterations}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#6E6E6E] font-mono">
            <span>{MIN_ITER}</span>
            <span>{MAX_ITER}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CopilotSettingsSection;
