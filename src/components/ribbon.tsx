import {
  Clipboard,
  Brush,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Minus,
  Type,
  type LucideIcon,
} from 'lucide-react';

/* ---------------------------------------------------------------------------
   Data-driven document ribbon. Every command is one row in `RIBBON`.
   Adding a new command is a one-entry change, not duplicated JSX.
--------------------------------------------------------------------------- */

const exec = (cmd: string, arg?: string) => document.execCommand(cmd, false, arg);

type RibbonButton = {
  kind: 'button';
  id: string;
  icon: LucideIcon;
  title: string;
  exec: () => void;
};

type RibbonColor = {
  kind: 'color';
  id: string;
  title: string;
  command: 'foreColor' | 'hiliteColor';
  /** Bottom-bar accent shown on the trigger. */
  accent: string;
  /** Visual rendered inside the trigger. */
  display: 'A' | 'brush';
};

type RibbonSelect = {
  kind: 'select';
  id: string;
  command: 'fontName' | 'fontSize';
  options: { value: string; label: string }[];
  defaultValue: string;
  width: string;
  /** Optional decorative icon slotted at right edge of the trigger. */
  icon?: LucideIcon;
};

type RibbonDivider = { kind: 'divider' };

type RibbonItem = RibbonButton | RibbonColor | RibbonSelect | RibbonDivider;

const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: 'Aptos', label: 'Aptos' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Calibri', label: 'Calibri' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Courier New', label: 'Courier New' },
  { value: 'Geist', label: 'Geist' },
];

// `fontSize` execCommand uses 1..7 — opaque keys mapped to display labels.
const FONT_SIZES: { value: string; label: string }[] = [
  { value: '1', label: '8' },
  { value: '2', label: '10' },
  { value: '3', label: '12' },
  { value: '4', label: '14' },
  { value: '5', label: '18' },
  { value: '6', label: '24' },
  { value: '7', label: '36' },
];

const RIBBON: ReadonlyArray<RibbonItem> = [
  { kind: 'button', id: 'paste', icon: Clipboard, title: 'Paste', exec: () => exec('paste') },
  { kind: 'button', id: 'formatpaint', icon: Brush, title: 'Format Painter', exec: () => {} },
  { kind: 'divider' },
  {
    kind: 'select',
    id: 'fontfamily',
    command: 'fontName',
    options: FONT_FAMILIES,
    defaultValue: 'Aptos',
    width: 'w-36',
    icon: Type,
  },
  {
    kind: 'select',
    id: 'fontsize',
    command: 'fontSize',
    options: FONT_SIZES,
    defaultValue: '3',
    width: 'w-14',
  },
  { kind: 'divider' },
  { kind: 'button', id: 'bold', icon: Bold, title: 'Bold', exec: () => exec('bold') },
  { kind: 'button', id: 'italic', icon: Italic, title: 'Italic', exec: () => exec('italic') },
  { kind: 'button', id: 'underline', icon: Underline, title: 'Underline', exec: () => exec('underline') },
  { kind: 'button', id: 'strike', icon: Strikethrough, title: 'Strikethrough', exec: () => exec('strikeThrough') },
  { kind: 'divider' },
  { kind: 'color', id: 'forecolor', title: 'Text Color', command: 'foreColor', accent: '#F85149', display: 'A' },
  { kind: 'color', id: 'hilitecolor', title: 'Highlight', command: 'hiliteColor', accent: '#D29922', display: 'brush' },
  { kind: 'divider' },
  { kind: 'button', id: 'alignleft', icon: AlignLeft, title: 'Align Left', exec: () => exec('justifyLeft') },
  { kind: 'button', id: 'aligncenter', icon: AlignCenter, title: 'Align Center', exec: () => exec('justifyCenter') },
  { kind: 'button', id: 'alignright', icon: AlignRight, title: 'Align Right', exec: () => exec('justifyRight') },
  { kind: 'button', id: 'justify', icon: AlignJustify, title: 'Justify', exec: () => exec('justifyFull') },
  { kind: 'divider' },
  { kind: 'button', id: 'ul', icon: List, title: 'Bulleted List', exec: () => exec('insertUnorderedList') },
  { kind: 'button', id: 'ol', icon: ListOrdered, title: 'Numbered List', exec: () => exec('insertOrderedList') },
  { kind: 'button', id: 'outdent', icon: Outdent, title: 'Outdent', exec: () => exec('outdent') },
  { kind: 'button', id: 'indent', icon: Indent, title: 'Indent', exec: () => exec('indent') },
  { kind: 'divider' },
  { kind: 'button', id: 'hr', icon: Minus, title: 'Horizontal Rule', exec: () => exec('insertHorizontalRule') },
];

function RibbonIconBtn({ icon: Icon, title, onClick }: { icon: LucideIcon; title: string; onClick: () => void }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="h-7 w-7 flex items-center justify-center transition-colors rounded-sm text-[#A1A1A1] hover:text-white hover:bg-[#161616] border border-transparent"
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function RibbonColorBtn({ item }: { item: RibbonColor }) {
  return (
    <label
      className="h-7 w-7 flex items-center justify-center text-[#A1A1A1] hover:text-white hover:bg-[#161616] transition-colors cursor-pointer relative rounded-sm"
      title={item.title}
    >
      {item.display === 'A' ? (
        <span className="text-[11px] font-bold leading-none" style={{ borderBottom: `2px solid ${item.accent}` }}>
          A
        </span>
      ) : (
        <Brush className="w-3.5 h-3.5" style={{ borderBottom: `2px solid ${item.accent}` }} />
      )}
      <input
        type="color"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => exec(item.command, e.target.value)}
      />
    </label>
  );
}

function RibbonSelectBtn({ item }: { item: RibbonSelect }) {
  const Icon = item.icon;
  return (
    <div className="relative">
      <select
        onChange={(e) => exec(item.command, e.target.value)}
        defaultValue={item.defaultValue}
        className={`h-7 pl-2 ${
          Icon ? 'pr-6' : 'pr-5'
        } appearance-none bg-[#111111] border border-[#1F1F1F] hover:border-[#2A2A2A] text-[11px] text-[#EDEDED] font-mono outline-none cursor-pointer rounded-sm ${item.width} focus:border-[#2F81F7]`}
      >
        {item.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {Icon ? (
        <Icon className="w-3 h-3 text-[#6E6E6E] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      ) : null}
    </div>
  );
}

function RibbonDividerBar() {
  return <div className="h-6 w-px bg-[#1F1F1F] mx-1.5" />;
}

export function Ribbon() {
  return (
    <div className="h-10 flex items-center px-2 border-b border-[#1A1A1A] bg-[#0C0C0C] overflow-x-auto">
      {RIBBON.map((item, i) => {
        if (item.kind === 'divider') return <RibbonDividerBar key={`div-${i}`} />;
        if (item.kind === 'button')
          return <RibbonIconBtn key={item.id} icon={item.icon} title={item.title} onClick={item.exec} />;
        if (item.kind === 'color') return <RibbonColorBtn key={item.id} item={item} />;
        return <RibbonSelectBtn key={item.id} item={item} />;
      })}
    </div>
  );
}
