import type { ReactNode } from "react"
import { useDroppable } from "@dnd-kit/core"
import { Badge } from "@/components/ui/badge"

interface KanbanColumnProps {
  id: string
  title: string
  taskCount: number
  children: ReactNode
  isActive?: boolean
}

export function KanbanColumn({ id, title, taskCount, children, isActive }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-72 rounded-lg p-3 transition-all duration-200"
      style={{
        backgroundColor: "#1a1a1a",
        border: isActive ? "2px solid rgb(59, 130, 246)" : "1px solid rgb(64, 64, 64)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-sm">
          {title}{" "}
          <Badge
            variant="secondary"
            className="ml-2 bg-gray-700 text-gray-200 hover:bg-gray-700 text-xs"
          >
            {taskCount}
          </Badge>
        </h3>
      </div>
      <div>{children}</div>
    </div>
  )
}
