import { useMemo, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  FileIcon,
  ImageIcon,
  FolderIcon,
  FolderPlusIcon,
  StarIcon,
  MoreVerticalIcon,
  EditIcon,
  UploadIcon,
  LinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XIcon,
  ArrowLeftIcon,
} from "lucide-react"
import { usePocketBase } from "@/services/filesys-store"
import type { ManagedFile, Folder } from "@/services/filesys-store"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DataTable } from "@/components/data-table"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

const WORKSPACE_ROOT = "workspace-root"

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Add remove workspace action with confirm & recursive deletion



export default function Workspaces() {
  const { files, folders, setFiles, setFolders, toggleFileFavorite: toggleFileFavoritePB, moveFileToTrash: moveFileToTrashPB, moveFolderToTrash: moveFolderToTrashPB } = usePocketBase()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false)
  const [newWorkspaceFolderName, setNewWorkspaceFolderName] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState("")
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingFileName, setEditingFileName] = useState("")

  const workspaceFolders = useMemo(() => folders.filter(f => f.parentId === WORKSPACE_ROOT), [folders])

  const currentWorkspace = useMemo(() => workspaceFolders.find(w => w.id === selectedWorkspaceId) ?? null, [workspaceFolders, selectedWorkspaceId])
  const currentFolder = useMemo(() => folders.find(f => f.id === selectedFolderId) ?? null, [folders, selectedFolderId])

  const workspaceFiles = useMemo(() => files.filter(f => f.folderId === selectedFolderId), [files, selectedFolderId])

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return workspaceFiles
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [workspaceFiles, searchQuery])

  const previewFile = useMemo(() => files.find((f) => f.id === previewId) || null, [files, previewId])

  const createWorkspace = () => {
    const name = (newWorkspaceName || "New Workspace").trim()
    if (!name) return
    const id = `ws-${Math.random().toString(36).slice(2)}`
    const newFolder: Folder = { id, name, parentId: WORKSPACE_ROOT, selected: false, favorite: false }
    setFolders(prev => [newFolder, ...prev])
    setSelectedWorkspaceId(id)
    setPreviewId(null)
    setNewWorkspaceName("")
    setCreateWorkspaceOpen(false)
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
        setSelectedFolderId(null)
        setPreviewId(null)
        setViewMode("grid")
      }
    } catch (error) {
      console.error('Error moving workspace to trash:', error)
      alert('Error moving workspace to trash. Please try again.')
    }
  }

  const onView = (id: string) => {
    setPreviewId(id)
    setFiles(prev => prev.map(f => f.id === id ? { ...f, openedAt: Date.now() } : f))
  }

  const download = (id: string) => {
    const f = files.find(x => x.id === id)
    if (!f) return
    const a = document.createElement("a")
    a.href = f.url
    a.download = f.name
    a.target = "_blank"
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const deleteOne = async (id: string) => {
    const f = files.find(x => x.id === id)
    if (!f) return
    try {
      await moveFileToTrashPB(id)
      if (previewId === id) setPreviewId(null)
    } catch (error) {
      console.error('Error moving file to trash:', error)
      alert('Error moving file to trash. Please try again.')
    }
  }

  const toggleFavorite = async (id: string) => {
    const f = files.find(x => x.id === id)
    if (!f) return
    // Optimistic UI
    setFiles(prev => prev.map(x => x.id === id ? { ...x, favorite: !x.favorite } : x))
    // Persist to PocketBase
    await toggleFileFavoritePB(id, !f.favorite)
  }

  const openRenameFile = (id: string) => {
    const f = files.find(x => x.id === id)
    if (!f) return
    setEditingFileId(id)
    setEditingFileName(f.name)
  }

  const applyRenameFile = () => {
    if (!editingFileId) return
    const newName = editingFileName.trim()
    if (!newName) { setEditingFileId(null); setEditingFileName(""); return }
    const now = Date.now()
    setFiles(prev => prev.map(x => x.id === editingFileId ? { ...x, name: newName, nameModifiedAt: now } : x))
    setEditingFileId(null)
    setEditingFileName("")
  }

  const cancelRenameFile = () => {
    setEditingFileId(null)
    setEditingFileName("")
  }

  const childFolders = useMemo(() => folders.filter(f => f.parentId === selectedFolderId), [folders, selectedFolderId])

  const inputRef = useRef<HTMLInputElement>(null)
  const handleAddFiles = (fileList: FileList | File[]) => {
    if (!selectedFolderId) return
    const now = Date.now()
    const items: ManagedFile[] = Array.from(fileList).map((file) => ({
      id: `wsfile-${now}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      type: file.type || "",
      url: URL.createObjectURL(file),
      lastModified: (file as any).lastModified ?? now,
      folderId: selectedFolderId,
      selected: false,
      favorite: false,
      createdAt: now,
      openedAt: null,
      nameModifiedAt: null,
    }))
    setFiles((prev) => [...items, ...prev])
    if (items.length) setPreviewId(items[0].id)
  }
  const createFolderInWorkspace = () => {
    if (!selectedFolderId) return
    const name = (newWorkspaceFolderName || "New Folder").trim()
    if (!name) return
    const folder: Folder = {
      id: `fld-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      parentId: selectedFolderId,
      selected: false,
      favorite: false,
    }
    setFolders((prev) => [folder, ...prev])
    setNewWorkspaceFolderName("")
    setCreateFolderDialogOpen(false)
  }

  const openRenameFolder = (id: string) => {
    const f = folders.find(x => x.id === id)
    if (!f) return
    setEditingFolderId(id)
    setEditingFolderName(f.name)
  }

  const applyRenameFolder = () => {
    if (!editingFolderId) return
    const name = editingFolderName.trim()
    if (!name) { setEditingFolderId(null); setEditingFolderName(""); return }
    setFolders(prev => prev.map(x => x.id === editingFolderId ? { ...x, name } : x))
    setEditingFolderId(null)
    setEditingFolderName("")
  }

  const cancelRenameFolder = () => {
    setEditingFolderId(null)
    setEditingFolderName("")
  }

  const removeFolder = async (id: string) => {
    const f = folders.find(x => x.id === id)
    if (!f) return
    const ok = confirm(`Move folder "${f.name}" and all its contents to trash?`)
    if (!ok) return

    try {
      await moveFolderToTrashPB(id)

      if (selectedFolderId === id) {
        const parentId = f.parentId
        setSelectedFolderId(parentId)
        setPreviewId(null)
      }
    } catch (error) {
      console.error('Error moving folder to trash:', error)
      alert('Error moving folder to trash. Please try again.')
    }
  }

  const moveFileTo = (id: string, destFolderId: string | null) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, folderId: destFolderId } : f))
    if (previewId === id && destFolderId !== selectedFolderId) setPreviewId(null)
  }

  const clearSelection = () => {
    setSelectedWorkspaceId(null)
    setSelectedFolderId(null)
    setPreviewId(null)
    setSearchQuery("")
    setViewMode("grid")
  }
  const goToDetail = (id: string) => {
    setSelectedWorkspaceId(id)
    setSelectedFolderId(id)
    setPreviewId(null)
    setViewMode("detail")
  }
  const goBack = () => {
    if (selectedFolderId && selectedWorkspaceId && selectedFolderId !== selectedWorkspaceId) {
      const cur = folders.find(f => f.id === selectedFolderId)
      const parentId = cur?.parentId ?? selectedWorkspaceId
      setSelectedFolderId(parentId)
      setPreviewId(null)
      return
    }
    clearSelection()
  }

  return (
    <div className="flex w-full h-full overflow-hidden flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
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
          <div className="text-sm">Workspaces <span className="mx-2">/</span> <span className="font-semibold">{currentWorkspace.name}</span>
            {selectedFolderId && selectedFolderId !== selectedWorkspaceId && currentFolder && (
              <>
                <span className="mx-2">/</span> <span className="font-semibold">{currentFolder.name}</span>
              </>
            )}
          </div>
          <Button onClick={goBack} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      )}

      {/* Files + Preview grid only after selecting a workspace and in detail mode */}
      {selectedWorkspaceId && viewMode === "detail" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left: files & folders list with actions */}
            <div className="md:col-span-2 rounded border p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {currentFolder ? `Items in ${currentFolder.name}` : "Select a workspace"}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => inputRef.current?.click()} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <UploadIcon className="mr-2 h-4 w-4" /> Upload
                  </Button>
                  <Input
                    ref={inputRef}
                    type="file"
                    multiple
                    onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => setCreateFolderDialogOpen(true)}>
                    <FolderPlusIcon className="mr-2 h-4 w-4" /> Create Folder
                  </Button>
                  <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Folder</DialogTitle>
                        <DialogDescription>Enter a name for your new folder.</DialogDescription>
                      </DialogHeader>
                      <div className="mt-2 flex flex-col gap-3">
                        <Input
                          autoFocus
                          value={newWorkspaceFolderName}
                          onChange={(e) => setNewWorkspaceFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              createFolderInWorkspace()
                            }
                          }}
                          placeholder="Folder name"
                        />
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setCreateFolderDialogOpen(false)}>Cancel</Button>
                          <Button onClick={createFolderInWorkspace}>Create</Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search items"
                    className="w-56"
                  />
                </div>
              </div>

              {/* Child folders */}
              {childFolders.length > 0 && (
                <div className="mb-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {childFolders.map((f) => (
                    <div key={f.id} onClick={() => setSelectedFolderId(f.id)} className="relative flex items-center gap-2 rounded border p-2 cursor-pointer hover:bg-muted" title={f.name}>
                      <FolderIcon className="h-4 w-4 text-muted-foreground" />
                      {editingFolderId === f.id ? (
                        <Input
                          className="h-8 px-2"
                          value={editingFolderName}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyRenameFolder()
                            if (e.key === "Escape") cancelRenameFolder()
                          }}
                          onBlur={() => applyRenameFolder()}
                        />
                      ) : (
                        <div className="truncate" title={f.name}>{f.name}</div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Folder actions"
                          >
                            <MoreVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => openRenameFolder(f.id)}>
                            <EditIcon className="mr-2 h-4 w-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => removeFolder(f.id)}>
                            <TrashIcon className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}

              {/* Files list */}
              {filteredFiles.length === 0 ? (
                <div className="text-sm text-muted-foreground">No files in this folder.</div>
              ) : (
                <div className="divide-y">
                  {filteredFiles.map((f) => (
                    <div key={f.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {f.type.startsWith("image/") ? (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        {editingFileId === f.id ? (
                          <Input
                            className="h-8 px-2"
                            value={editingFileName}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditingFileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") applyRenameFile()
                              if (e.key === "Escape") cancelRenameFile()
                            }}
                            onBlur={() => applyRenameFile()}
                          />
                        ) : (
                          <div className="truncate" title={f.name}>{f.name}</div>
                        )}
                        <div className="ml-2 shrink-0 text-muted-foreground text-xs">{formatBytes(f.size)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onView(f.id)}>
                          <EyeIcon className="mr-2 h-3 w-3" /> View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVerticalIcon className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => download(f.id)}>
                              <DownloadIcon className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteOne(f.id)}>
                              <TrashIcon className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFavorite(f.id)}>
                              <StarIcon className="mr-2 h-4 w-4" /> {f.favorite ? "Remove from Favorites" : "Add to Favorites"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRenameFile(f.id)}>
                              <EditIcon className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => moveFileTo(f.id, null)}>
                              <FolderIcon className="mr-2 h-4 w-4" /> Move to My Vault (root)
                            </DropdownMenuItem>
                            {folders.map(fl => (
                              <DropdownMenuItem key={fl.id} onClick={() => moveFileTo(f.id, fl.id)}>
                                <FolderIcon className="mr-2 h-4 w-4" /> Move to {fl.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: preview */}
            <div className="rounded border p-3">
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span>Preview</span>
                {previewFile && (
                  <Button size="sm" variant="ghost" aria-label="Close preview" onClick={() => setPreviewId(null)}>
                    <XIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!previewFile ? (
                <div className="text-sm text-muted-foreground">Select a file to preview.</div>
              ) : (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  <div className="text-sm">
                    <span className="font-medium">{previewFile.name}</span>
                    {previewFile.size != null && (
                      <span className="text-muted-foreground"> · {formatBytes(previewFile.size)}</span>
                    )}
                  </div>
                  {previewFile.type.startsWith("image/") ? (
                    <img
                      src={previewFile.url}
                      title={previewFile.name}
                      className="max-h-64 w-full rounded object-contain animate-in fade-in-0 duration-200"
                    />
                  ) : previewFile.type.startsWith("text/") || previewFile.type.includes("svg") ? (
                    <iframe
                      src={previewFile.url}
                      title={previewFile.name}
                      className="h-64 w-full rounded border animate-in fade-in-0 duration-200"
                    />
                  ) : (
                    <a
                      href={previewFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      Open in new tab
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Team / Members section (between items and tasks) */}
          <TeamSection />

          {/* Tasks / To-do section (below two containers) */}
          <TasksSection />

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
                    This will delete the workspace and its items. Continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => removeWorkspace(selectedWorkspaceId!)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  )
}

// Simple team/members section
function TeamSection() {
  type Member = { id: string; name: string; email: string; role: "Owner" | "Admin" | "Member" | "Viewer"; status: "Active" | "Invited" | "Suspended" }
  const [members, setMembers] = useState<Member[]>([])
  const [isOpen, setIsOpen] = useState(true)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter(m => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  }, [members, query])

  const [inviteOpen, setInviteOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState<Member["role"]>("Member")

  const handleInvite = () => {
    const name = newName.trim()
    const email = newEmail.trim()
    if (!email) return
    const id = `mem-${Math.random().toString(36).slice(2)}`
    setMembers(prev => [{ id, name: name || email.split("@")[0], email, role: newRole, status: "Invited" }, ...prev])
    setNewName(""); setNewEmail(""); setNewRole("Member"); setInviteOpen(false)
  }

  // Map to DataTable schema
  const tableData = useMemo(() => {
    return filtered.map((m, idx) => ({
      id: idx + 1,
      refId: m.id,
      header: m.name,
      type: "Member",
      status: m.status,
      target: m.role,
      limit: "",
      reviewer: m.email,
    }))
  }, [filtered])


  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setIsOpen(!isOpen)}>
          Members
          {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team" className="w-48" />
          <Popover open={inviteOpen} onOpenChange={setInviteOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">Invite</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label htmlFor="member-name">Name</Label>
                  <Input id="member-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="member-email">Email</Label>
                  <Input id="member-email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="name@example.com" />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as Member["role"])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner">Owner</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Member">Member</SelectItem>
                      <SelectItem value="Viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { setInviteOpen(false); setNewName(""); setNewEmail(""); setNewRole("Member") }}>Cancel</Button>
                  <Button onClick={handleInvite} disabled={!newEmail.trim()}>Invite</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {isOpen && (
        <DataTable
          data={tableData as any}
          variant="members"
          onStatusChange={(refId, newStatus) =>
            setMembers(prev => prev.map(m => m.id === String(refId) ? { ...m, status: newStatus as Member["status"] } : m))
          }
          onDeleteSelected={(refIds) => {
            const toDelete = new Set(refIds.map(String))
            setMembers(prev => prev.filter(m => !toDelete.has(m.id)));
          }}
        />
      )}
    </div>
  )
}

// Simple tasks/to-do section scaffold
function TasksSection() {
  type Task = { id: string; title: string; status: "In Progress" | "Todo" | "Backlog" | "Complete"; priority: "High" | "Medium" | "Low"; }
  const [tasks, setTasks] = useState<Task[]>([])
  const [isOpen, setIsOpen] = useState(true)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks.filter(t => !q || t.title.toLowerCase().includes(q))
  }, [tasks, query])

  const [addOpen, setAddOpen] = useState(false)
  const [newId, setNewId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newStatus, setNewStatus] = useState<Task["status"]>("Todo")
  const [newPriority, setNewPriority] = useState<Task["priority"]>("Medium")

  const resetNewTask = () => {
    setNewId("")
    setNewTitle("")
    setNewStatus("Todo")
    setNewPriority("Medium")
  }

  const handleCreateTask = () => {
    const id = (newId || `task-${Math.random().toString(36).slice(2)}`).trim()
    const title = newTitle.trim()
    if (!title) return
    setTasks(prev => [{ id, title, status: newStatus, priority: newPriority }, ...prev])
    resetNewTask()
    setAddOpen(false)
  }

  // Map tasks to the DataTable schema and force remount when filtered changes
  const tableData = useMemo(() => {
    return filtered.map((t, idx) => ({
      id: idx + 1,
      refId: t.id,
      header: t.title,
      type: "Task",
      status: t.status,
      target: t.priority,
      limit: "",
      reviewer: "",
    }))
  }, [filtered])


  return (
    <div className="rounded border p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="flex items-center gap-2 text-sm font-semibold" onClick={() => setIsOpen(!isOpen)}>
          Tasks
          {isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" className="w-48" />
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">Add Task</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label htmlFor="task-id">Task ID</Label>
                  <Input id="task-id" placeholder="e.g. TASK-123" value={newId} onChange={(e) => setNewId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="task-title">Title</Label>
                  <Input id="task-title" placeholder="Write task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as Task["status"]) }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Todo">Todo</SelectItem>
                        <SelectItem value="Backlog">Backlog</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Priority</Label>
                    <Select value={newPriority} onValueChange={(v) => setNewPriority(v as Task["priority"]) }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { resetNewTask(); setAddOpen(false) }}>Cancel</Button>
                  <Button onClick={handleCreateTask} disabled={!newTitle.trim()}>Add</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {isOpen && (
        <DataTable
          data={tableData as any}
          onStatusChange={(refId, newStatus) =>
            setTasks(prev => prev.map(t => t.id === String(refId) ? { ...t, status: newStatus as Task["status"] } : t))
          }
          onDeleteSelected={(refIds) => {
            const toDelete = new Set(refIds.map(String))
            setTasks(prev => prev.filter(t => !toDelete.has(t.id)))
          }}
        />
      )}
    </div>
  )
}
