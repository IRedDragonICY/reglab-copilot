const fs = require('fs');
let code = fs.readFileSync('src/components/AppMain.tsx', 'utf8');

const tabStripOld = code.substring(
  code.indexOf('<div className="h-9 flex items-end bg-[#0A0A0A]">'),
  code.indexOf('</div>\n        </div>\n      </div>\n\n      {/* ---------- Main Content Area ---------- */}')
);

const tabStripNew = `
<div className="h-9 flex items-end bg-[#0A0A0A]">
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
              <ScrollBar orientation="horizontal" className="h-1" />
            </ScrollArea>
          </DndContext>
        </div>
`;

if (tabStripOld.length > 50) {
  code = code.replace(tabStripOld, tabStripNew.trim());
  fs.writeFileSync('src/components/AppMain.tsx', code);
}
