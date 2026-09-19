import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { EyeIcon, DownloadIcon, StarIcon, FileIcon, ImageIcon, FolderIcon, XIcon, CheckSquareIcon, SquareIcon, StarOffIcon, FilterIcon, ChevronLeftIcon } from "lucide-react"
import { useFileSystem } from "@/services/filesys-store"
import type { ManagedFile, Folder } from "@/services/filesys-store"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu"

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${val} ${sizes[i]}`
}

type FavItem = { kind: "file"; file: ManagedFile } | { kind: "folder"; folder: Folder }

export default function Favorites() {
  const { files, folders, setFiles, setFolders, toggleFileFavorite: toggleFileFavoritePB, toggleFolderFavorite: toggleFolderFavoritePB } = useFileSystem()

  const items: FavItem[] = useMemo(() => {
    const favFiles = files.filter((f) => f.favorite)
    const favFolders = folders.filter((f) => f.favorite)
    return [
      ...favFolders.map((folder) => ({ kind: "folder" as const, folder })),
      ...favFiles.map((file) => ({ kind: "file" as const, file })),
    ]
  }, [files, folders])

  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilters, setTypeFilters] = useState<string[]>([])
  const toggleTypeFilter = (key: string) =>
    setTypeFilters((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])

  const getFileTypeKey = (f: ManagedFile) => {
    const name = f.name.toLowerCase()
    const ext = name.includes(".") ? name.split(".").pop()! : ""
    const mime = (f.type || "").toLowerCase()
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

  const filteredItems: FavItem[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matchesType = (it: FavItem) => {
      if (typeFilters.length === 0) return true
      return it.kind === "folder" ? typeFilters.includes("folder") : typeFilters.includes(getFileTypeKey(it.file))
    }
    const base = items.filter(matchesType)
    if (!q) return base
    return base.filter((it) => {
      const name = it.kind === "file" ? it.file.name : it.folder.name
      return name.toLowerCase().includes(q)
    })
  }, [items, searchQuery, typeFilters])

  const [preview, setPreview] = useState<{ kind: "file" | "folder"; id: string } | null>(null)
  const [folderContextId, setFolderContextId] = useState<string | null>(null)
  const previewFile: ManagedFile | null = useMemo(() => {
    if (!preview || preview.kind !== "file") return null
    return files.find((f) => f.id === preview.id) || null
  }, [preview, files])
  const previewFolder: Folder | null = useMemo(() => {
    if (!preview || preview.kind !== "folder") return null
    return folders.find((f) => f.id === preview.id) || null
  }, [preview, folders])
  // text preview state
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const isTextFile = (f: ManagedFile) => {
    const name = (f.name || "").toLowerCase()
    return (
      (f.type || "").startsWith("text/") ||
      (f.type || "").includes("svg") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".json") ||
      name.endsWith(".csv") ||
      name.endsWith(".log") ||
      name.endsWith(".env") ||
      name.endsWith(".ini") ||
      name.endsWith(".yaml") ||
      name.endsWith(".yml") ||
      name.endsWith(".xml") ||
      name.endsWith(".js") ||
      name.endsWith(".ts") ||
      name.endsWith(".tsx") ||
      name.endsWith(".jsx")
    )
  }

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
    return () => {
      cancelled = true
    }
  }, [previewFile])
  const toggleSelectFile = (id: string) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f))
  }
  const toggleSelectFolder = (id: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f))
  }

  const selectAllFiltered = () => {
    const allSelected = filteredItems.length > 0 && filteredItems.every((it) => it.kind === "file" ? it.file.selected : it.folder.selected)
    const fileIds = filteredItems.filter(it => it.kind === "file").map(it => it.file.id)
    const folderIds = filteredItems.filter(it => it.kind === "folder").map(it => it.folder.id)
    setFiles((prev) => prev.map((f) => fileIds.includes(f.id) ? { ...f, selected: !allSelected } : f))
    setFolders((prev) => prev.map((f) => folderIds.includes(f.id) ? { ...f, selected: !allSelected } : f))
  }

  const removeSelectedFromFavorites = async () => {
    const fileIds = filteredItems.filter((it): it is { kind: "file"; file: ManagedFile } => it.kind === "file" && it.file.selected).map(it => it.file.id)
    const folderIds = filteredItems.filter((it): it is { kind: "folder"; folder: Folder } => it.kind === "folder" && it.folder.selected).map(it => it.folder.id)
    if (preview && ((preview.kind === "file" && fileIds.includes(preview.id)) || (preview.kind === "folder" && folderIds.includes(preview.id)))) {
      setPreview(null)
    }
    // Optimistic updates
    setFiles((prev) => prev.map((f) => fileIds.includes(f.id) ? { ...f, favorite: false, selected: false } : f))
    setFolders((prev) => prev.map((f) => folderIds.includes(f.id) ? { ...f, favorite: false, selected: false } : f))
    // Persist to PocketBase
    for (const id of fileIds) {
      await toggleFileFavoritePB(id, false)
    }
    for (const id of folderIds) {
      await toggleFolderFavoritePB(id, false)
    }
  }


  const download = async (id: string) => {
    const f = files.find((x) => x.id === id)
    if (!f) return
    const isZip = f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip")
    const hasEntries = Array.isArray(f.archiveEntries) && (f.archiveEntries?.length ?? 0) > 0
    if (isZip && hasEntries) {
      const crcTable = (() => {
        const table = new Uint32Array(256)
        for (let n = 0; n < 256; n++) {
          let c = n
          for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
          table[n] = c >>> 0
        }
        return table
      })()
      const crc32 = (buf: Uint8Array) => {
        let c = 0xFFFFFFFF
        for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
        return (c ^ 0xFFFFFFFF) >>> 0
      }
      const toDosTimeDate = (ms: number) => {
        const d = new Date(ms)
        const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((Math.floor(d.getSeconds() / 2) & 0x1F))
        const date = (((d.getFullYear() - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | ((d.getDate() & 0x1F))
        return { time, date }
      }
      const enc = new TextEncoder()
      const u16 = (n: number) => new Uint8Array([n & 0xFF, (n >> 8) & 0xFF])
      const u32 = (n: number) => new Uint8Array([n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF])
      const sig = (n: number) => u32(n >>> 0)

      type ZipEntry = { name: string; data: Uint8Array; modMs: number }
      const entries: ZipEntry[] = []

      for (const e of f.archiveEntries!) {
        const orig = files.find((x) => x.id === e.fileId)
        if (!orig) continue
        const res = await fetch(orig.url)
        const b = await res.blob()
        const ab = await b.arrayBuffer()
        const data = new Uint8Array(ab)
        const name = [...(e.path || []), orig.name].join("/")
        entries.push({ name, data, modMs: orig.lastModified || Date.now() })
      }
      if (entries.length === 0) {
        const a = document.createElement("a")
        a.href = f.url
        a.download = f.name
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }

      const fileParts: Uint8Array[] = []
      const centralParts: Uint8Array[] = []
      let offset = 0
      const locals: { nameBytes: Uint8Array; crc: number; size: number; time: number; date: number; offset: number }[] = []

      function concat(arrs: (Uint8Array | Uint8Array[])[]): Uint8Array {
        const flat: Uint8Array[] = []
        for (const a of arrs) {
          if (Array.isArray(a)) flat.push(...a as Uint8Array[])
          else flat.push(a)
        }
        const total = flat.reduce((n, a) => n + a.length, 0)
        const out = new Uint8Array(total)
        let pos = 0
        for (const a of flat) { out.set(a, pos); pos += a.length }
        return out
      }

      for (const ent of entries) {
        const nameBytes = enc.encode(ent.name)
        const size = ent.data.length
        const crc = crc32(ent.data)
        const { time, date } = toDosTimeDate(ent.modMs)
        const localHeader = [
          sig(0x04034B50),
          u16(20),
          u16(0),
          u16(0),
          u16(time), u16(date),
          u32(crc), u32(size), u32(size),
          u16(nameBytes.length), u16(0),
          nameBytes,
        ]
        const local = concat(localHeader)
        fileParts.push(local)
        fileParts.push(ent.data)
        locals.push({ nameBytes, crc, size, time, date, offset })
        offset += local.length + size
      }

      for (const l of locals) {
        const centralHeader = [
          sig(0x02014B50),
          u16(0x0314),
          u16(20),
          u16(0),
          u16(0),
          u16(l.time), u16(l.date),
          u32(l.crc), u32(l.size), u32(l.size),
          u16(l.nameBytes.length), u16(0), u16(0),
          u16(0), u16(0),
          u32(0),
          u32(l.offset),
          l.nameBytes,
        ]
        centralParts.push(concat(centralHeader))
      }

      const central = concat(centralParts)
      const endRecord = concat([
        sig(0x06054B50),
        u16(0), u16(0),
        u16(locals.length), u16(locals.length),
        u32(central.length),
        u32(offset),
        u16(0),
      ])

      const zipBytes = concat([concat(fileParts), central, endRecord])
      const zipBlob = new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" })
      const url = URL.createObjectURL(zipBlob)

      setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, url, size: zipBlob.size, lastModified: Date.now() } : x))

      const a = document.createElement("a")
      a.href = url
      a.download = f.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }

    const a = document.createElement("a")
    a.href = f.url
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <StarIcon className="w-5 h-5" /> Favorites
        </h2>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Your starred items</span>
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
              {filteredItems.length > 0 && filteredItems.every((it) => it.kind === "file" ? it.file.selected : it.folder.selected) ? (
                <CheckSquareIcon className="mr-2 h-4 w-4" />
              ) : (
                <SquareIcon className="mr-2 h-4 w-4" />
              )}
              Select All
            </Button>
            <Button
              onClick={removeSelectedFromFavorites}
              disabled={!filteredItems.some((it) => it.kind === "file" ? it.file.selected : it.folder.selected)}
              variant="destructive"
            >
              <StarOffIcon className="mr-2 h-4 w-4" /> Remove from Favorites
            </Button>
            <div className="ml-auto w-full max-w-xs">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search favorites..."
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
                <div className="p-4 text-sm text-muted-foreground">{searchQuery ? "No matching items." : "No favorites yet."}</div>
              )}
              {filteredItems.map((it) => (
                <div key={it.kind === "file" ? it.file.id : it.folder.id} className="group grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-2 rounded transition-colors hover:bg-muted/50" onMouseEnter={() => { if (it.kind === "file") { setPreview({ kind: "file", id: it.file.id }); } else { setPreview({ kind: "folder", id: it.folder.id }); } }}>
                  <button
                    onClick={() => it.kind === "file" ? toggleSelectFile(it.file.id) : toggleSelectFolder(it.folder.id)}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                    aria-label={(it.kind === "file" ? it.file.selected : it.folder.selected) ? "Unselect" : "Select"}
                  >
                    {(it.kind === "file" ? it.file.selected : it.folder.selected) ? (
                      <CheckSquareIcon className="h-4 w-4" />
                    ) : (
                      <SquareIcon className="h-4 w-4" />
                    )}
                  </button>
                  <div className="flex items-center gap-2 truncate">
                    {it.kind === "file" ? (
                      it.file.type.startsWith("image/") ? (
                        <ImageIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                      ) : (
                        <FileIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                      )
                    ) : (
                      <FolderIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                    )}
                    <span className="truncate" title={it.kind === "file" ? it.file.name : it.folder.name}>{it.kind === "file" ? it.file.name : it.folder.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {it.kind === "file" ? (
                      formatBytes(it.file.size)
                    ) : (
                      `${files.filter((f) => f.folderId === it.folder.id).length} items`
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {it.kind === "file" ? (
                      <>
                        <Button size="sm" variant="outline" className="transition-colors" onClick={() => { setFolderContextId(null); setPreview({ kind: "file", id: it.file.id }); }}>
                          <EyeIcon className="mr-1 h-4 w-4" /> View
                        </Button>
                        <Button size="sm" variant="outline" className="transition-colors" onClick={() => download(it.file.id)}>
                          <DownloadIcon className="mr-1 h-4 w-4" /> Download
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="transition-colors" onClick={() => { setFolderContextId(it.folder.id); setPreview({ kind: "folder", id: it.folder.id }); }}>
                          <FolderIcon className="mr-1 h-4 w-4" /> Open
                        </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-md border p-3 max-h-[66vh] overflow-y-auto">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
            <span>Preview</span>
            {preview && (
              <Button size="sm" variant="ghost" aria-label="Close preview" onClick={() => { setPreview(null); setFolderContextId(null); }}>
                <XIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          {!preview && (
            <div className="text-sm text-muted-foreground">Select an item to preview.</div>
          )}
          {previewFile && (
                <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                  {folderContextId && (
                    <div className="flex items-center justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setPreview({ kind: "folder", id: folderContextId! })}>
                        <ChevronLeftIcon className="mr-1 h-4 w-4" /> Back
                      </Button>
                    </div>
                  )}
                  <div className="text-sm">
                <span className="font-medium">{previewFile.name}</span>
                {previewFile.size != null && (
                  <span className="text-muted-foreground"> · {formatBytes(previewFile.size)}</span>
                )}
              </div>
              {(() => {
                const isZip = previewFile.type === "application/zip" || previewFile.name.toLowerCase().endsWith(".zip")
                const hasEntries = Array.isArray(previewFile.archiveEntries) && (previewFile.archiveEntries?.length ?? 0) > 0
                if (isZip && hasEntries) {
                  const entries = previewFile.archiveEntries!
                  return (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">{entries.length} file(s) in archive</div>
                      <div className="rounded border">
                        {entries.map((e, idx) => {
                          const orig = files.find((x) => x.id === e.fileId)
                          const rel = [...(e.path || []), orig ? orig.name : "(missing)"]
                          return (
                            <div key={`${e.fileId}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-1 text-sm border-b last:border-b-0">
                              <div className="truncate" title={rel.join("/")}>{rel.join("/")}</div>
                              <div className="text-xs text-muted-foreground">{orig ? formatBytes(orig.size) : "—"}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
                if (previewFile.type.startsWith("image/")) {
                  return <img src={previewFile.url} alt={previewFile.name} className="max-h-64 w-full rounded object-contain animate-in fade-in-0 duration-200" />
                }
                if (isTextFile(previewFile)) {
                  if (previewLoading) {
                    return <div className="text-sm text-muted-foreground">Loading preview…</div>
                  }
                  if (previewError) {
                    return <div className="text-sm text-destructive">{previewError}</div>
                  }
                  return (
                    <pre className="h-64 w-full rounded border bg-muted/20 p-3 text-xs overflow-auto">
                      {previewText ?? ""}
                    </pre>
                  )
                }
                return (
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    Open in new tab
                  </a>
                )
              })()}
            </div>
          )}
          {previewFolder && (
            <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{previewFolder.name}</span>
                  <span className="text-muted-foreground"> · {files.filter((f) => f.folderId === previewFolder.id).length} items</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const parentId = folders.find((fl) => fl.id === previewFolder.id)?.parentId ?? null
                      if (parentId) {
                        setFolderContextId(parentId)
                        setPreview({ kind: "folder", id: parentId })
                      } else {
                        setFolderContextId(null)
                        setPreview(null)
                      }
                    }}
                  >
                    <ChevronLeftIcon className="mr-1 h-4 w-4" /> Back
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {folders.filter((fl) => fl.parentId === previewFolder.id).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Folders</div>
                    <div className="rounded border">
                      {folders.filter((fl) => fl.parentId === previewFolder.id).map((fl) => (
                        <div key={fl.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1 text-sm border-b last:border-b-0">
                          <div className="flex items-center gap-2 truncate">
                            <FolderIcon className="h-4 w-4" />
                            <span className="truncate" title={fl.name}>{fl.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{files.filter((f) => f.folderId === fl.id).length} items</div>
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setFolderContextId(fl.id); setPreview({ kind: "folder", id: fl.id }); }}>Open</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {files.filter((f) => f.folderId === previewFolder.id).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Files</div>
                    <div className="rounded border">
                      {files.filter((f) => f.folderId === previewFolder.id).map((f) => (
                        <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1 text-sm border-b last:border-b-0">
                          <div className="flex items-center gap-2 truncate">
                            {f.type.startsWith("image/") ? (
                              <ImageIcon className="h-4 w-4" />
                            ) : (
                              <FileIcon className="h-4 w-4" />
                            )}
                            <span className="truncate" title={f.name}>{f.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{formatBytes(f.size)}</div>
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setFolderContextId(previewFolder!.id); setPreview({ kind: "file", id: f.id }); }}>View</Button>
                            <Button size="sm" variant="outline" onClick={() => download(f.id)}>Download</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {folders.filter((fl) => fl.parentId === previewFolder.id).length === 0 && files.filter((f) => f.folderId === previewFolder.id).length === 0 && (
                  <div className="text-sm text-muted-foreground">This folder is empty.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
