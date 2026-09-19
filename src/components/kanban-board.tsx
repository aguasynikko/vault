import { useState } from "react"
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { KanbanColumn } from "./kanban-column"
import { KanbanCard } from "./kanban-card"

export interface Task {
  id: string
  title: string
  description: string
  category: string
  priority: "Low" | "Medium" | "High" | "Urgent"
  assignee: {
    name: string
    avatar: string
  }
  columnId: string
}

export interface KanbanBoardProps {
  tasks: Record<string, Task[]>
  onTaskMove?: (taskId: string, fromColumnId: string, toColumnId: string, newPosition: number) => void
  onTaskEdit?: (taskId: string) => void
}

const COLUMN_ORDER = ["todo", "in-progress", "in-review", "done"]
const COLUMN_LABELS = {
  "todo": "To Do",
  "in-progress": "In Progress",
  "in-review": "In Review",
  "done": "Done",
}

export function KanbanBoard({ tasks, onTaskMove, onTaskEdit }: KanbanBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [sourceColumnId, setSourceColumnId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string
    setActiveTaskId(taskId)

    // Find which column this task belongs to
    for (const [columnId, columnTasks] of Object.entries(tasks)) {
      if (columnTasks.some((t) => t.id === taskId)) {
        setSourceColumnId(columnId)
        break
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over) {
      setActiveTaskId(null)
      setSourceColumnId(null)
      return
    }

    const taskId = active.id as string
    const targetId = over.id as string

    // Determine target column
    let targetColumnId: string | null = null
    let targetPosition = 0

    // Check if over is a column
    if (COLUMN_ORDER.includes(targetId as string)) {
      targetColumnId = targetId as string
      targetPosition = (tasks[targetColumnId] || []).length
    } else {
      // Over is a task, find its column and position
      for (const [columnId, columnTasks] of Object.entries(tasks)) {
        const taskIndex = columnTasks.findIndex((t) => t.id === targetId)
        if (taskIndex !== -1) {
          targetColumnId = columnId
          targetPosition = taskIndex
          break
        }
      }
    }

    if (sourceColumnId && targetColumnId && onTaskMove) {
      onTaskMove(taskId, sourceColumnId, targetColumnId, targetPosition)
    }

    setActiveTaskId(null)
    setSourceColumnId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-hidden pb-4 min-h-[500px] w-full">
        {COLUMN_ORDER.map((columnId) => {
          const columnTasks = tasks[columnId] || []
          const taskIds = columnTasks.map((t) => t.id)

          return (
            <SortableContext
              key={columnId}
              items={taskIds}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                id={columnId}
                title={COLUMN_LABELS[columnId as keyof typeof COLUMN_LABELS]}
                taskCount={columnTasks.length}
                isActive={activeTaskId !== null && sourceColumnId === columnId}
              >
                {columnTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-48 border-2 border-dashed border-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">No tasks yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {columnTasks.map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        isActive={activeTaskId === task.id}
                        onEdit={onTaskEdit}
                      />
                    ))}
                  </div>
                )}
              </KanbanColumn>
            </SortableContext>
          )
        })}
      </div>
    </DndContext>
  )
}
