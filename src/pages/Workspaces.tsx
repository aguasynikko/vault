import { useMemo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FolderIcon,
  FolderPlusIcon,
  MoreVerticalIcon,
  EditIcon,
  LinkIcon,
  ArrowLeftIcon,
  TrashIcon,
  PlusIcon,
  X,
} from "lucide-react"
import { useFileSystem } from "@/services/filesys-store"
import type { Folder } from "@/services/filesys-store"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { KanbanBoard, type Task as KanbanTask } from "@/components/kanban-board"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

const WORKSPACE_ROOT = "workspace-root"

// Sample task data structure - maps column IDs to task arrays
const INITIAL_TASKS: Record<string, KanbanTask[]> = {}

export default function Workspaces() {
  const { folders, setFolders, moveFolderToTrash: moveFolderToTrashPB } = useFileSystem()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid")
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [tasks, setTasks] = useState<Record<string, KanbanTask[]>>(INITIAL_TASKS)
  const [workspaceLabels, setWorkspaceLabels] = useState<Record<string, string[]>>({})
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("Medium")
  const [newTaskAssignee, setNewTaskAssignee] = useState("")
  const [newLabelInput, setNewLabelInput] = useState("")
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])

  const workspaceFolders = useMemo(() => folders.filter(f => f.parentId === WORKSPACE_ROOT), [folders])

  const currentWorkspace = useMemo(() => workspaceFolders.find(w => w.id === selectedWorkspaceId) ?? null, [workspaceFolders, selectedWorkspaceId])

  const createWorkspace = () => {
    const name = (newWorkspaceName || "New Workspace").trim()
    if (!name) return
    const id = `ws-${Math.random().toString(36).slice(2)}`
    const newFolder: Folder = { id, name, parentId: WORKSPACE_ROOT, selected: false, favorite: false }
    setFolders(prev => [newFolder, ...prev])
    setSelectedWorkspaceId(id)
    setWorkspaceLabels(prev => ({ ...prev, [id]: [] }))
    setTasks(prev => ({ ...prev }))
    setNewWorkspaceName("")
    setCreateWorkspaceOpen(false)
  }

  const openCreateTask = () => {
    setEditingTaskId(null)
    setNewTaskTitle("")
    setNewTaskDescription("")
    setNewTaskPriority("Medium")
    setNewTaskAssignee("")
    setSelectedLabels([])
    setCreateTaskOpen(true)
  }

  const openEditTask = (taskId: string) => {
    const task = Object.values(tasks).flat().find(t => t.id === taskId)
    if (!task) return
    setEditingTaskId(taskId)
    setNewTaskTitle(task.title)
    setNewTaskDescription(task.description || "")
    setNewTaskPriority(task.priority || "Medium")
    setNewTaskAssignee(task.assignee?.name || "")
    setSelectedLabels((task as any).labels || [])
    setCreateTaskOpen(true)
  }

  const addLabelToWorkspace = () => {
    if (!selectedWorkspaceId || !newLabelInput.trim()) return
    const label = newLabelInput.trim()
    setWorkspaceLabels(prev => ({
      ...prev,
      [selectedWorkspaceId]: [...new Set([...(prev[selectedWorkspaceId] || []), label])]
    }))
    setNewLabelInput("")
  }

  const createOrUpdateTask = () => {
    const title = (newTaskTitle || "New Task").trim()
    if (!title) return

    if (editingTaskId) {
      // Update existing task
      setTasks(prev => {
        const newTasks = { ...prev }
        for (const columnId of Object.keys(newTasks)) {
          const taskIndex = newTasks[columnId].findIndex(t => t.id === editingTaskId)
          if (taskIndex !== -1) {
            const updatedTask = {
              ...newTasks[columnId][taskIndex],
              title,
              description: newTaskDescription.trim(),
              priority: newTaskPriority,
              assignee: newTaskAssignee ? {
                name: newTaskAssignee,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newTaskAssignee)}`
              } : { name: "Unassigned", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=unassigned" },
              labels: selectedLabels
            } as any
            newTasks[columnId][taskIndex] = updatedTask
            break
          }
        }
        return newTasks
      })
    } else {
      // Create new task
      const id = `task-${Math.random().toString(36).slice(2)}`
      const newTask: any = {
        id,
        title,
        description: newTaskDescription.trim(),
        category: "General",
        priority: newTaskPriority,
        assignee: newTaskAssignee ? {
          name: newTaskAssignee,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newTaskAssignee)}`
        } : { name: "Unassigned", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=unassigned" },
        columnId: "todo",
        labels: selectedLabels
      }
      setTasks(prev => ({
        ...prev,
        "todo": [newTask, ...(prev["todo"] || [])]
      }))
    }

    setNewTaskTitle("")
    setNewTaskDescription("")
    setNewTaskPriority("Medium")
    setNewTaskAssignee("")
    setSelectedLabels([])
    setCreateTaskOpen(false)
    setEditingTaskId(null)
  }

  const renameWorkspace = (id: string) => {
    const ws = folders.find(f => f.id === id)
    if (!ws) return
    const name = prompt("Rename workspace", ws.name)?.trim()
    if (!name || name === ws.name) return
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))
  }

  const copyWorkspaceLink = (id: string) => {
    const url = `${window.location.origin}/workspaces?ws=${encodeURIComponent(id)}`
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {})
    } else {
      prompt("Copy this link", url)
    }
  }

  const removeWorkspace = async (id: string) => {
    const ws = folders.find(f => f.id === id)
    if (!ws) return
    const ok = confirm(`Move workspace "${ws.name}" to trash?`)
    if (!ok) return

    try {
      await moveFolderToTrashPB(id)

      if (selectedWorkspaceId === id) {
        setSelectedWorkspaceId(null)
        setViewMode("grid")
      }
    } catch (error) {
      console.error('Error moving workspace to trash:', error)
      alert('Error moving workspace to trash. Please try again.')
    }
  }

  const clearSelection = () => {
    setSelectedWorkspaceId(null)
    setViewMode("grid")
  }

  const goToDetail = (id: string) => {
    setSelectedWorkspaceId(id)
    setViewMode("detail")
  }

  const goBack = () => {
    clearSelection()
  }

  // Kanban board handlers
  const handleTaskMove = useCallback((taskId: string, fromColumnId: string, toColumnId: string, newPosition: number) => {
    setTasks((prevTasks) => {
      // Clone the tasks object
      const newTasks = { ...prevTasks }

      // Find and remove the task from source column
      const sourceTaskIndex = newTasks[fromColumnId].findIndex((t) => t.id === taskId)
      if (sourceTaskIndex === -1) return prevTasks

      const [movedTask] = newTasks[fromColumnId].splice(sourceTaskIndex, 1)

      // Insert task into destination column at the correct position
      const targetTasks = newTasks[toColumnId] || []
      const insertPosition = Math.min(newPosition, targetTasks.length)
      const updatedTask = { ...movedTask, columnId: toColumnId }
      targetTasks.splice(insertPosition, 0, updatedTask)

      newTasks[toColumnId] = targetTasks
      return newTasks
    })
  }, [])

  return (
    <div className="flex w-full h-full overflow-y-auto overflow-x-hidden flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FolderIcon className="w-5 h-5" /> Workspaces
        </h2>
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
      </div>

      {/* Workspace selector */}
      {viewMode === "grid" && (
        <div className="rounded border p-5">
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-white text-black hover:bg-white/90 border border-input"
              onClick={() => setCreateWorkspaceOpen(true)}
            >
              <FolderPlusIcon className="mr-2 h-4 w-4" /> Create Workspace
            </Button>
          </div>
          <br />
          <Sheet open={createWorkspaceOpen} onOpenChange={setCreateWorkspaceOpen}>
            <SheetContent side="left" className="w-[360px] sm:w-[260px]">
              <SheetHeader>
                <SheetTitle>Create Workspace</SheetTitle>
                <SheetDescription>Enter a name for your new workspace.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-3">
                <Input
                  autoFocus
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      createWorkspace()
                    }
                  }}
                  placeholder="Workspace name"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCreateWorkspaceOpen(false)}>Cancel</Button>
                  <Button onClick={createWorkspace}>Create</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          {workspaceFolders.length === 0 ? (
            <div className="text-sm text-muted-foreground">No workspaces yet. Create one to get started.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {workspaceFolders.map((w) => (
                <div
                  key={w.id}
                  onClick={() => goToDetail(w.id)}
                  className={`relative flex flex-col items-center gap-2 rounded border p-4 hover:bg-muted`}
                  title={w.name}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Workspace actions"
                      >
                        <MoreVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => renameWorkspace(w.id)}>
                        <EditIcon className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => removeWorkspace(w.id)}>
                        <TrashIcon className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyWorkspaceLink(w.id)}>
                        <LinkIcon className="mr-2 h-4 w-4" /> Copy Link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <FolderIcon className="h-10 w-10" />
                  <span className="text-sm font-medium truncate w-full text-center">{w.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb + Back in detail mode */}
      {viewMode === "detail" && currentWorkspace && (
        <div className="flex items-center justify-between rounded border p-3">
          <div className="text-sm font-semibold">{currentWorkspace.name}</div>
          <Button onClick={goBack} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      )}

      {/* Kanban Board - only after selecting a workspace and in detail mode */}
      {selectedWorkspaceId && viewMode === "detail" && (
        <>
          {/* Kanban Board for Tasks */}
          <div className="rounded border p-4 overflow-x-hidden min-w-0 flex flex-col w-full">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Workspace Tasks</h3>
              <Button onClick={openCreateTask} size="sm">
                <PlusIcon className="mr-2 h-4 w-4" /> Add Task
              </Button>
            </div>
            {/* Workspace tasks container with responsive flexbox layout */}
            <div className="flex overflow-x-hidden w-full gap-4 bg-gray-100 rounded p-4">
              <KanbanBoard
                tasks={tasks}
                onTaskMove={handleTaskMove}
                onTaskEdit={openEditTask}
              />
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex justify-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <TrashIcon className="mr-2 h-4 w-4" /> Delete Workspace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete workspace</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete the workspace and all its data. Continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => removeWorkspace(selectedWorkspaceId!)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Task Creation/Edit Modal Dialog */}
          {createTaskOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">
                    {editingTaskId ? "Edit Task" : "Create Task"}
                  </h2>
                  <button
                    onClick={() => setCreateTaskOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Task Title */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Task Title*</label>
                    <Input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Enter task title"
                    />
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder="Enter task description"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Priority */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Priority</label>
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Assigned Member */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Assigned Member</label>
                    <Input
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      placeholder="Enter assignee name"
                    />
                  </div>

                  {/* Labels */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium">Labels</label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newLabelInput}
                        onChange={(e) => setNewLabelInput(e.target.value)}
                        placeholder="Add new label"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            addLabelToWorkspace()
                          }
                        }}
                      />
                      <Button onClick={addLabelToWorkspace} size="sm" variant="outline">
                        Add
                      </Button>
                    </div>

                    {/* Available labels */}
                    {selectedWorkspaceId && workspaceLabels[selectedWorkspaceId] && workspaceLabels[selectedWorkspaceId].length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {workspaceLabels[selectedWorkspaceId].map((label) => (
                          <Badge
                            key={label}
                            variant={selectedLabels.includes(label) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              setSelectedLabels(prev =>
                                prev.includes(label)
                                  ? prev.filter(l => l !== label)
                                  : [...prev, label]
                              )
                            }}
                          >
                            {label}
                            {selectedLabels.includes(label) && (
                              <X className="w-3 h-3 ml-1" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setCreateTaskOpen(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createOrUpdateTask}
                      className="flex-1"
                    >
                      {editingTaskId ? "Update Task" : "Create Task"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
