import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EditIcon } from "lucide-react"
import type { Task } from "./kanban-board"

interface KanbanCardProps {
  task: Task
  isActive?: boolean
  onEdit?: (taskId: string) => void
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Design: { bg: "bg-blue-900", text: "text-blue-100" },
  Frontend: { bg: "bg-purple-900", text: "text-purple-100" },
  Backend: { bg: "bg-green-900", text: "text-green-100" },
  QA: { bg: "bg-orange-900", text: "text-orange-100" },
  DevOps: { bg: "bg-red-900", text: "text-red-100" },
  Documentation: { bg: "bg-yellow-900", text: "text-yellow-100" },
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  Low: { color: "bg-gray-600", label: "●" },
  Medium: { color: "bg-blue-600", label: "●" },
  High: { color: "bg-orange-600", label: "●" },
  Urgent: { color: "bg-red-600", label: "●" },
}

export function KanbanCard({ task, onEdit }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const categoryStyle = CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Frontend
  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.Medium

  const initials = task.assignee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative bg-gray-900 rounded-lg p-4 cursor-grab active:cursor-grabbing border border-gray-800 transition-all duration-200 hover:border-gray-700 ${
        isDragging ? "shadow-lg shadow-blue-500/50" : ""
      }`}
    >
      {/* Edit Button - Top Right (hidden until hover) */}
      {onEdit && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 bg-gray-800 hover:bg-gray-700 border border-gray-700"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task.id)
            }}
          >
            <EditIcon className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Category Badge - Top */}
      <div className="flex items-start justify-between mb-2">
        <Badge className={`${categoryStyle.bg} ${categoryStyle.text} border-0`}>
          {task.category}
        </Badge>
      </div>

      {/* Title */}
      <h4 className="font-bold text-white mb-2 line-clamp-2 text-sm">{task.title}</h4>

      {/* Description with icon */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-gray-500 text-sm flex-shrink-0 mt-0.5">≡</span>
        <p className="text-gray-400 text-xs line-clamp-2">{task.description}</p>
      </div>

      {/* Labels */}
      {(task as any).labels && (task as any).labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {(task as any).labels.map((label: string) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      )}

      {/* Bottom: Priority + Assignee */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className={`${priorityConfig.color} rounded-full w-2 h-2`} />
          <span className="text-gray-300 text-xs font-medium">{task.priority}</span>
        </div>

        {/* Assignee Avatar */}
        <Avatar className="h-6 w-6 border border-gray-700">
          <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
          <AvatarFallback className="bg-gray-800 text-gray-300 text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  )
}
