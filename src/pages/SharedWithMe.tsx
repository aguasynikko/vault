import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { EyeIcon, DownloadIcon, FileIcon, ImageIcon, XIcon, CheckSquareIcon, SquareIcon, PlusIcon, TrashIcon, FilterIcon, ShareIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { useFileSystem } from "@/services/filesys-store"
import type { ManagedFile } from "@/services/filesys-store"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${val} ${sizes[i]}`
}

type SharedFile = {
  id: string
  name: string
  url: string
  type: string
  size: number | null
  selected: boolean
}

export default function SharedWithMe() {
  const [items, setItems] = useState<SharedFile[]>([])

  useEffect(() => {
    let cancelled = false
    items.forEach(async (item) => {
      if (item.size != null) return
      try {
        const res = await fetch(item.url)
        const blob = await res.blob()
        if (!cancelled) {
          setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, size: blob.size } : it))
        }
      } catch (e) {
        // ignore fetch errors
      }
    })
    return () => { cancelled = true }
  }, [items])

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const toggleTypeFilter = (key: string) =>
    setTypeFilters((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

  const getFileTypeKey = (it: { name: string; type: string }) => {
    const name = it.name.toLowerCase()
    const ext = name.includes(".") ? name.split(".").pop()! : ""
    const mime = (it.type || "").toLowerCase()
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

  const isTextFile = (it: { name: string; type: string }) => {
    const name = (it.name || "").toLowerCase()
    const ext = name.includes(".") ? name.split(".").pop()! : ""
    const mime = (it.type || "").toLowerCase()
    if (mime.startsWith("text/")) return true
    const textExts = ["txt", "md", "json", "csv", "log", "xml", "yaml", "yml", "ini", "conf", "svg"]
    return textExts.includes(ext)
  }

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matchesType = (it: SharedFile) =>
      typeFilters.length === 0 || typeFilters.includes(getFileTypeKey(it))
    const base = items.filter(matchesType)
    if (!q) return base
    return base.filter((it) => it.name.toLowerCase().includes(q))
  }, [items, searchQuery, typeFilters])

  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it))
  }

  const selectAllFiltered = () => {
    const allSelected = filteredItems.length > 0 && filteredItems.every(it => it.selected)
    const ids = new Set(filteredItems.map(it => it.id))
    setItems(prev => prev.map(it => ids.has(it.id) ? { ...it, selected: !allSelected } : it))
  }



  const [previewId, setPreviewId] = useState<string | null>(null)
  const previewFile = useMemo(() => items.find((i) => i.id === previewId) || null, [items, previewId])
  const { setFiles } = useFileSystem()

  // Inline text preview state
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (!previewFile || !isTextFile(previewFile)) {
      setPreviewText(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    fetch(previewFile.url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
        const text = await res.text()
        if (!cancelled) setPreviewText(text)
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(err?.message || "Failed to load preview")
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => { cancelled = true }
  }, [previewFile])

  const download = (id: string) => {
    const it = items.find((i) => i.id === id)
    if (!it) return
    const a = document.createElement("a")
    a.href = it.url
    a.download = it.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const addSelectedToMyFiles = () => {
    const now = Date.now()
    const selected = items.filter(it => it.selected)
    if (selected.length === 0) return
    const newFiles: ManagedFile[] = selected.map(it => ({
      id: `sharedcopy-${now}-${Math.random().toString(36).slice(2)}`,
      name: it.name,
      size: it.size ?? 0,
      type: it.type,
      url: it.url,
      lastModified: now,
      folderId: null,
      selected: false,
      favorite: false,
      createdAt: now,
      openedAt: null,
      nameModifiedAt: null,
    }))
    setFiles(prev => [...newFiles, ...prev])
  }



  const deleteSelected = () => {
    const delIds = new Set(items.filter(it => it.selected).map(it => it.id))
    if (delIds.size === 0) return
    setItems(prev => prev.filter(it => !delIds.has(it.id)))
    // Close preview if it was deleted
    if (previewId && delIds.has(previewId)) setPreviewId(null)
  }



  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ShareIcon className="w-5 h-5" /> Shared with Me
        </h2>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Files shared with you. Read-only.</span>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Items list */}
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
              {filteredItems.length > 0 && filteredItems.every((it) => it.selected) ? (
                <CheckSquareIcon className="mr-2 h-4 w-4" />
              ) : (
                <SquareIcon className="mr-2 h-4 w-4" />
              )}
              Select All
            </Button>
            <Button
              variant="outline"
              onClick={addSelectedToMyFiles}
              disabled={!items.some((it) => it.selected)}
            >
              <PlusIcon className="mr-2 h-4 w-4" /> Add to My Vault
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!items.some((it) => it.selected)}
                >
                  <TrashIcon className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete selected</AlertDialogTitle>
                  <AlertDialogDescription>
                    Remove selected shared items from your view?
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
                placeholder="Search shared files..."
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
              {filteredItems.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">{searchQuery ? "No matching shared files." : "No shared files yet."}</div>
              )}
              {filteredItems.map((it) => (
                <div key={it.id} className="group grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-2 rounded transition-colors hover:bg-muted/50" onMouseEnter={() => setPreviewId(it.id)}>
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
                    {it.type.startsWith("image/") ? (
                      <ImageIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    ) : (
                      <FileIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    )}
                    <span className="truncate" title={it.name}>{it.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{it.size != null ? formatBytes(it.size) : <div className="h-3 w-10 rounded bg-muted animate-pulse" />}</div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="transition-colors" onClick={() => setPreviewId(it.id)}>
                      <EyeIcon className="mr-1 h-4 w-4" /> View
                    </Button>
                    <Button size="sm" variant="outline" className="transition-colors" onClick={() => download(it.id)}>
                      <DownloadIcon className="mr-1 h-4 w-4" /> Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-md border p-3 max-h-[66vh] overflow-y-auto">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>Shared Preview</span>
            {previewFile && (
              <Button size="sm" variant="ghost" aria-label="Close preview" onClick={() => setPreviewId(null)}>
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!previewFile && (
            <div className="text-sm text-muted-foreground">Select a file to preview.</div>
          )}
          {previewFile && (
            <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              <div className="text-sm">
                <span className="font-medium">{previewFile.name}</span>
                {previewFile.size != null && (
                  <span className="text-muted-foreground"> · {formatBytes(previewFile.size)}</span>
                )}
              </div>
              {previewFile.type.startsWith("image/") ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-64 w-full rounded object-contain animate-in fade-in-0 duration-200" />
              ) : isTextFile(previewFile) ? (
                previewLoading ? (
                  <div className="text-sm text-muted-foreground">Loading preview…</div>
                ) : previewError ? (
                  <div className="text-sm text-destructive">{previewError}</div>
                ) : previewText != null ? (
                  <pre className="h-64 w-full rounded border p-2 overflow-auto whitespace-pre-wrap">{previewText}</pre>
                ) : (
                  <div className="text-sm text-muted-foreground">No preview available.</div>
                )
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
    </div>
  )
}
