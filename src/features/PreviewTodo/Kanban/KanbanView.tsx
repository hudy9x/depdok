import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useTodoDocument } from "../useTodoDocument";
import { TodoItem } from "../TodoItem";
import { getBoardId, getItemId } from "./dndTypes";
import { useTodoDragAndDrop } from "./useTodoDragAndDrop";
import { SortableBoard } from "./SortableBoard";
import { AddSectionBoard } from "./AddSectionBoard";
import { DraggingBoardOverlay } from "./DraggingBoardOverlay";

interface KanbanViewProps {
  document: ReturnType<typeof useTodoDocument>["document"];
  editable: boolean;
  handlers: Omit<ReturnType<typeof useTodoDocument>, "document" | "handleModeChange">;
}

export function KanbanView({ document, editable, handlers }: KanbanViewProps) {
  const {
    handleToggleItem,
    handleUpdateItemTitle,
    handleUpdateItemMetadata,
    handleRemoveItem,
    handleAddItem,
    handleSectionTitleChange,
    handleSectionColorChange,
    handleRemoveSection,
    handleAddSection,
    handleSetSectionsOrder,
    handleMoveItem,
  } = handlers;

  const sortedSections = [...document.sections].sort((a, b) => {
    const orderA = a.metadata?.order ?? 999;
    const orderB = b.metadata?.order ?? 999;
    return orderA - orderB;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const {
    liveSections,
    activeBoardSection,
    activeItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel
  } = useTodoDragAndDrop({
    sortedSections,
    documentSections: document.sections,
    handleSetSectionsOrder,
    handleMoveItem
  });

  const sectionsToRender = liveSections ?? sortedSections.map((s, si) => ({
    ...s,
    _id: getBoardId(si),
    _origIdx: si,
    _docIdx: document.sections.indexOf(s),
    items: s.items.map((item, ii) => ({
      ...item,
      _id: getItemId(si, ii),
      _origSectionIdx: si,
      _origItemIdx: ii,
    })),
  }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full w-full overflow-x-auto p-2 bg-background">
        <SortableContext
          items={sectionsToRender.map(s => s._id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex h-full gap-4 items-start">
            {sectionsToRender.map((section) => {
              const docSectionIndex = document.sections.indexOf(sortedSections[section._origIdx]);
              return (
                <SortableBoard
                  key={section._id}
                  section={section}
                  docSectionIndex={docSectionIndex}
                  config={document.config}
                  editable={editable}
                  onSectionTitleChange={handleSectionTitleChange}
                  onSectionColorChange={handleSectionColorChange}
                  onRemoveSection={handleRemoveSection}
                  onToggleItem={handleToggleItem}
                  onUpdateItemTitle={handleUpdateItemTitle}
                  onUpdateItemMetadata={handleUpdateItemMetadata}
                  onRemoveItem={handleRemoveItem}
                  onAddItem={handleAddItem}
                />
              );
            })}

            {editable && (
              <AddSectionBoard onAddSection={handleAddSection} />
            )}
          </div>
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeBoardSection && (
          <DraggingBoardOverlay
            title={activeBoardSection.title}
            itemsCount={activeBoardSection.items.length}
          />
        )}
        {activeItem && (
          <div className="w-72 rotate-1 shadow-xl opacity-95">
            <TodoItem
              item={activeItem}
              sectionIndex={0}
              itemIndex={0}
              config={document.config}
              editable={false}
              onToggle={() => { }}
              onUpdateTitle={() => { }}
              onUpdateMetadata={() => { }}
              onRemove={() => { }}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
