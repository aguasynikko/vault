import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EyeIcon, RotateCcwIcon, TrashIcon, FileIcon, ImageIcon, FolderIcon, XIcon, CheckSquareIcon, SquareIcon, FilterIcon } from "lucide-react"
import { useFileSystem } from "@/services/filesys-store"
import type { ManagedFile } from "@/services/filesys-store"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${val} ${sizes[i]}`
}

export default function TrashArchive() {
  const { trash, setTrash, restoreFromTrash: restoreFromTrashPB, deleteFromTrashPermanently: deleteFromTrashPermanentlyPB } = useFileSystem()

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const toggleTypeFilter = (key: string) =>
    setTypeFilters((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

  const getFileTypeKey = (f: ManagedFile) => {
    const name = f.name.toLowerCase()
    const ext = name.includes(".") ? name.split(".").pop()! : ""
    const mime = (f.type || "").toLowerCase()
    if (mime === "folder") return "folder"
    if (ext === "jpg" || ext === "jpeg" || mime.startsWith("image/jpeg")) return "jpg"
    if (ext === "png" || mime.startsWith("image/png")) return "png"
    if (ext === "gif" || mime.startsWith("image/gif")) return "gif"
    if (ext === "svg" || mime.includes("svg")) return "svg"
    if (ext === "pdf" || mime.includes("pdf")) return "pdf"
    if (ext === "zip" || mime.includes("zip")) return "zip"
    if (ext === "xlsx" || ext === "xls" || mime.includes("sheet") || mime.includes("excel")) return "excel"
    if (ext === "docx" || ext === "doc" || mime.includes("word")) return "word"
    if (ext === "py") return "python"
    if (ext === "txt" || mime.startsWith("text/plain")) return "txt"
    if (ext === "csv" || mime.includes("csv")) return "csv"
    return "other"
  }

  const filteredTrashItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matchesType = (it: ManagedFile) =>
      typeFilters.length === 0 || typeFilters.includes(getFileTypeKey(it))
    const base = trash.filter(matchesType)
    if (!q) return base
    return base.filter((it) => it.name.toLowerCase().includes(q))
  }, [trash, searchQuery, typeFilters])

  const [previewTrashId, setPreviewTrashId] = useState<string | null>(null)
  const previewTrash: ManagedFile | null = useMemo(
    () => trash.find((i) => i.id === previewTrashId) || null,
    [trash, previewTrashId]
  )

  const toggleSelect = (id: string) => {
    setTrash(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it))
  }

  const selectAllFiltered = () => {
    const ids = filteredTrashItems.map(it => it.id)
    const allSelected = filteredTrashItems.length > 0 && filteredTrashItems.every(it => it.selected)
    setTrash(prev => prev.map(it => ids.includes(it.id) ? { ...it, selected: !allSelected } : it))
  }

  const deleteSelected = async () => {
    const toDelete = trash.filter(it => it.selected).map(it => it.id)
    try {
      for (const id of toDelete) {
        await deleteFromTrashPermanentlyPB(id)
      }
      if (previewTrashId && toDelete.includes(previewTrashId)) setPreviewTrashId(null)
    } catch (error) {
      console.error('Error deleting items from trash:', error)
      alert('Error deleting items from trash. Please try again.')
    }
  }

  const restore = async (item: ManagedFile) => {
    try {
      await restoreFromTrashPB(item.id)
      if (previewTrashId === item.id) setPreviewTrashId(null)
    } catch (error) {
      console.error('Error restoring item from trash:', error)
      alert('Error restoring item from trash. Please try again.')
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrashIcon className="w-5 h-5" /> Trash
        </h2>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Manage your deleted items.</span>
      </div>

      {/* Items */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Trash list (left) */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FilterIcon className="mr-2 h-4 w-4" /> Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("folder")} onCheckedChange={() => toggleTypeFilter("folder")}>Folder</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("jpg")} onCheckedChange={() => toggleTypeFilter("jpg")}>JPG</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("png")} onCheckedChange={() => toggleTypeFilter("png")}>PNG</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("gif")} onCheckedChange={() => toggleTypeFilter("gif")}>GIF</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("svg")} onCheckedChange={() => toggleTypeFilter("svg")}>SVG</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("pdf")} onCheckedChange={() => toggleTypeFilter("pdf")}>PDF</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("zip")} onCheckedChange={() => toggleTypeFilter("zip")}>ZIP</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("excel")} onCheckedChange={() => toggleTypeFilter("excel")}>Excel</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("word")} onCheckedChange={() => toggleTypeFilter("word")}>Word</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("python")} onCheckedChange={() => toggleTypeFilter("python")}>Python</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("txt")} onCheckedChange={() => toggleTypeFilter("txt")}>Text</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={typeFilters.includes("csv")} onCheckedChange={() => toggleTypeFilter("csv")}>CSV</DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTypeFilters([])}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={selectAllFiltered}>
              {filteredTrashItems.length > 0 && filteredTrashItems.every((it) => it.selected) ? (
                <CheckSquareIcon className="mr-2 h-4 w-4" />
              ) : (
                <SquareIcon className="mr-2 h-4 w-4" />
              )}
              Select All
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!trash.some((it) => it.selected)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <TrashIcon className="mr-2 h-4 w-4" /> Delete Permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete permanently</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. Remove selected items from Trash?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteSelected}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="ml-auto w-full max-w-xs">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trash..."
                className="h-9"
              />
            </div>
          </div>

          <div className="rounded-md border p-2 max-h-[66vh] overflow-y-auto">
            <div className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <div></div>
              <div>Name</div>
              <div>Size</div>
              <div>Actions</div>
            </div>
            <div className="divide-y">
              {filteredTrashItems.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">{searchQuery ? "No matching items in trash." : "No items in trash."}</div>
              )}
              {filteredTrashItems.map((it) => (
                <div key={it.id} className="group grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-2 rounded transition-colors hover:bg-muted/50">
                  <button
                    onClick={() => toggleSelect(it.id)}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                    aria-label={it.selected ? "Unselect" : "Select"}
                  >
                    {it.selected ? (
                      <CheckSquareIcon className="h-4 w-4" />
                    ) : (
                      <SquareIcon className="h-4 w-4" />
                    )}
                  </button>
                  <div className="flex items-center gap-2 truncate">
                    {it.type === "folder" ? (
                      <FolderIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    ) : it.type.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    ) : (
                      <FileIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    )}
                    <span className="truncate" title={it.name}>{it.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{formatBytes(it.size)}</div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="transition-colors" onClick={() => setPreviewTrashId(it.id)}>
                      <EyeIcon className="mr-1 h-4 w-4" /> View
                    </Button>
                    <Button size="sm" variant="outline" className="transition-colors" onClick={() => restore(it)}>
                      <RotateCcwIcon className="mr-1 h-4 w-4" /> Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Preview (right) */}
        <div className="rounded-md border p-3 max-h-[66vh] overflow-y-auto">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>Trash Preview</span>
            {previewTrash && (
              <Button size="sm" variant="ghost" aria-label="Close preview" onClick={() => setPreviewTrashId(null)}>
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!previewTrash && (
            <div className="text-sm text-muted-foreground">Select a file to preview.</div>
          )}
          {previewTrash && (
            <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              <div className="text-sm">
                <span className="font-medium">{previewTrash.name}</span>
                {previewTrash.size != null && (
                  <span className="text-muted-foreground"> · {formatBytes(previewTrash.size)}</span>
                )}
              </div>
              {previewTrash.type === "folder" ? (
                <div className="text-sm text-muted-foreground">Folder contents can’t be previewed here.</div>
              ) : previewTrash.type.startsWith("image/") ? (
                <img src={previewTrash.url} alt={previewTrash.name} className="max-h-64 w-full rounded object-contain animate-in fade-in-0 duration-200" />
              ) : previewTrash.type.startsWith("text/") || previewTrash.type.includes("svg") ? (
                <iframe
                  src={previewTrash.url}
                  title={previewTrash.name}
                  className="h-64 w-full rounded border animate-in fade-in-0 duration-200"
                />
              ) : (
                <a
                  href={previewTrash.url}
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
    </div>
  )
}
