const fs = require('fs');
let code = fs.readFileSync('src/components/AppMain.tsx', 'utf8');

const dndImports = `
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
`;

if (!code.includes('@dnd-kit/core')) {
  code = code.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1} from 'lucide-react';" + dndImports);
}

const sortableTabItemCode = `
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
      className={\`group relative flex items-center gap-2 pl-3 pr-2 h-full cursor-pointer select-none min-w-[160px] max-w-[240px] border-r border-[#1F1F1F] \${
        isActive
          ? 'bg-[#0A0A0A] text-[#EDEDED]'
          : 'bg-[#0C0C0C] text-[#888888] hover:bg-[#111111] hover:text-[#CCCCCC]'
      }\`}
    >
      <span
        className={\`absolute top-0 left-0 right-0 h-[2px] \${
          isActive ? 'bg-[#2F81F7]' : 'bg-transparent'
        }\`}
      />
      {tab.type === 'home' ? (
        <Home className="w-3.5 h-3.5 shrink-0 text-[#A1A1A1]" />
      ) : (
        <FileText
          className={\`w-3.5 h-3.5 shrink-0 \${
            isActive ? 'text-[#2F81F7]' : 'text-[#6E6E6E]'
          }\`}
        />
      )}
      <span className="font-mono text-[11px] truncate flex-1">{tab.title}</span>
      {tab.type !== 'home' && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={\`w-5 h-5 flex items-center justify-center rounded-md hover:bg-[#2A2A2A] transition-colors \${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }\`}
        >
          <X className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}
`;

if (!code.includes('function SortableTab')) {
  code = code.replace('export default function AppMain() {', sortableTabItemCode + '\nexport default function AppMain() {');
}

const hooksCode = `
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
`;

if (!code.includes('handleDragEnd')) {
  code = code.replace('const store = useAppStore();', 'const store = useAppStore();\n' + hooksCode);
}

const tabStripRegex = /<div className="flex w-max h-9 items-stretch">[\s\S]*?<\/div>\s*<\/ScrollArea>/;

const replacementTabStrip = `
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex w-max h-9 items-stretch border-l border-[#1F1F1F]">
                <SortableContext
                  items={store.openTabs.map((t) => t.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {store.openTabs.map((tab) => (
                    <SortableTab
                      key={tab.id}
                      tab={tab}
                      isActive={store.activeTab === tab.id}
                      onClick={() => store.setActiveTab(tab.id)}
                      onClose={() => store.closeTab(tab.id)}
                    />
                  ))}
                </SortableContext>
              </div>
            </ScrollArea>
          </DndContext>
`;

if (!code.includes('<DndContext')) {
  code = code.replace(tabStripRegex, replacementTabStrip.trim() + '\n          </ScrollArea>');
}

fs.writeFileSync('src/components/AppMain.tsx', code);
