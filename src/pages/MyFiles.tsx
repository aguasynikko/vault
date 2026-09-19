import React, { useCallback, useMemo, useRef, useState, useEffect } from "react"
import { useFileSystem } from "@/services/filesys-store"
import {
  TrashIcon,
  EyeIcon,
  UploadIcon,
  CheckSquareIcon,
  SquareIcon,
  FileIcon,
  ImageIcon,
  FolderIcon,
  FolderPlusIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  DownloadIcon,
  MoreVerticalIcon,
  StarIcon,
  StarOffIcon,
  InfoIcon,
  PencilIcon,
  ArchiveIcon,
  XIcon,
  FilterIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"

// In-memory drive with folders and files. Supports drag/drop upload, selection,
// select all, preview, delete files, and folder creation + navigation.

type Folder = {
  id: string
  name: string
  parentId: string | null
  selected: boolean
  favorite: boolean
}

type ManagedFile = {
  id: string
  name: string
  size: number
  type: string
  url: string
  lastModified: number
  folderId: string | null
  selected: boolean
  favorite: boolean
  createdAt: number
  openedAt: number | null
  nameModifiedAt: number | null
  // Optional: if this is a ZIP, we store its source and entries
  archiveOfFolderId?: string | null
  archiveEntries?: { fileId: string; path: string[] }[]
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${val} ${sizes[i]}`
}

function formatDateTime(ts: number | null | undefined) {
  if (ts == null || !Number.isFinite(ts)) return "—"
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return "—"
  }
}

export default function MyFiles() {
  const { files, folders, setFiles, setFolders, uploadFile, 
    createFolder: createFolderPB,
    renameFile: renameFilePB,
    toggleFileFavorite: toggleFileFavoritePB,
    moveFile: moveFilePB,
    renameFolder: renameFolderPB,
    toggleFolderFavorite: toggleFolderFavoritePB,
    moveFolder: moveFolderPB,
    moveFileToTrash: moveFileToTrashPB,
    moveFolderToTrash: moveFolderToTrashPB,
    compressFolderToZip: compressFolderToZipPB,
  } = useFileSystem()
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null) // null = root (My Drive)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [movingFileId, setMovingFileId] = useState<string | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState<string>("")
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Folder actions state
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null)
  const [targetParentId, setTargetParentId] = useState<string | null>(null)
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState<string>("")
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
  const isTextFile = (f: ManagedFile) => {
    const name = f.name.toLowerCase()
    return f.type.startsWith("text/") || /\.(txt|md|csv|json|log|xml|html|svg)$/i.test(name)
  }

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId),
    [folders, currentFolderId]
  )
  const currentFiles = useMemo(
    () => files.filter((f) => f.folderId === currentFolderId),
    [files, currentFolderId]
  )
  const filteredChildFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const showFolders = typeFilters.length === 0 || typeFilters.includes("folder")
    const base = showFolders ? childFolders : []
    if (!q) return base
    return base.filter((f) => f.name.toLowerCase().includes(q))
  }, [childFolders, searchQuery, typeFilters])
  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const matchesType = (f: ManagedFile) =>
      typeFilters.length === 0 || typeFilters.includes(getFileTypeKey(f))
    const base = currentFiles.filter(matchesType)
    if (!q) return base
    return base.filter((f) => f.name.toLowerCase().includes(q))
  }, [currentFiles, searchQuery, typeFilters])

  const handleAddFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list)
    
    for (const f of arr) {
      try {
        await uploadFile(f, currentFolderId || undefined)
      } catch (error) {
        console.error(`Failed to upload file ${f.name}:`, error)
      }
    }
  }, [currentFolderId, uploadFile])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer?.files?.length) {
      handleAddFiles(e.dataTransfer.files)
    }
  }, [handleAddFiles])

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const createFolder = async () => {
    const name = (newFolderName || "New Folder").trim()
    await createFolderPB(name, currentFolderId)
    setNewFolderName("")
  }

  const openFolder = (id: string) => {
    setCurrentFolderId(id)
    setPreviewId(null)
  }

  const goUp = () => {
    if (currentFolderId === null) return
    const parent = folders.find((f) => f.id === currentFolderId)?.parentId ?? null
    setCurrentFolderId(parent)
    setPreviewId(null)
  }

  // Helper: get all descendant folder IDs including the folder itself
  const getDescendantFolderIds = (rootId: string) => {
    const ids = new Set<string>()
    const stack = [rootId]
    while (stack.length) {
      const cur = stack.pop() as string
      ids.add(cur)
      const children = folders.filter((f) => f.parentId === cur)
      children.forEach((ch) => stack.push(ch.id))
    }
    return ids
  }

  const deleteFolder = async (id: string) => {
    const ids = getDescendantFolderIds(id)
    const filesInFolders = files.filter((f) => f.folderId && ids.has(f.folderId))
    const needsConfirm = filesInFolders.length > 0 || ids.size > 1
    if (needsConfirm) {
      const ok = window.confirm(`Move folder and all contents to trash? (${filesInFolders.length} file(s), ${Math.max(ids.size - 1, 0)} subfolder(s))`)
      if (!ok) return
    }
    await moveFolderToTrashPB(id)
    if (previewId && filesInFolders.some((f) => f.id === previewId)) setPreviewId(null)
  }

  const getBreadcrumb = useMemo(() => {
    const chain: { id: string | null; name: string }[] = []
    let id = currentFolderId
    while (id) {
      const f = folders.find((x) => x.id === id)
      if (!f) break
      chain.push({ id: f.id, name: f.name })
      id = f.parentId
    }
    chain.reverse()
    return [{ id: null, name: "My Vault" }, ...chain]
  }, [folders, currentFolderId])

  const toggleSelectFile = (id: string) => {
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f))
  }
  const toggleSelectFolder = (id: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, selected: !f.selected } : f))
  }

  const selectAll = () => {
    const allSelected = currentFiles.every((f) => f.selected) && childFolders.every((f) => f.selected)
    setFiles((prev) => prev.map((f) => f.folderId === currentFolderId ? { ...f, selected: !allSelected } : f))
    setFolders((prev) => prev.map((f) => f.parentId === currentFolderId ? { ...f, selected: !allSelected } : f))
  }

  const deleteSelected = async () => {
    const selectedFiles = currentFiles.filter((f) => f.selected)
    const selectedFolders = childFolders.filter((f) => f.selected)

    let foldersToDelete = new Set<string>()
    selectedFolders.forEach((fld) => {
      const ids = getDescendantFolderIds(fld.id)
      ids.forEach((id) => foldersToDelete.add(id))
    })

    const filesFromFolders = files.filter((f) => f.folderId && foldersToDelete.has(f.folderId))
    if (selectedFolders.length > 0) {
      const ok = window.confirm(`Move ${selectedFolders.length} folder(s) and ${filesFromFolders.length} file(s) within them to trash?`)
      if (!ok) return
    }

    try {
      // Compute selected folder ids for exclusion
      const selectedFolderIds = new Set(selectedFolders.map(f => f.id))

      // Move selected files to trash, excluding those within selected folders to avoid duplicates
      for (const file of selectedFiles) {
        if (!file.folderId || !selectedFolderIds.has(file.folderId)) {
          await moveFileToTrashPB(file.id)
        }
      }

      // Move selected folders to trash (this will also handle files within them)
      for (const folder of selectedFolders) {
        await moveFolderToTrashPB(folder.id)
      }

      if (previewId) {
        const movedOrDeleted = [...selectedFiles, ...filesFromFolders].some((f) => f.id === previewId)
        if (movedOrDeleted) setPreviewId(null)
      }
    } catch (error) {
      console.error('Error moving items to trash:', error)
      alert('Error moving items to trash. Please try again.')
    }
  }

  const deleteOne = async (id: string) => {
    const f = files.find((x) => x.id === id)
    if (!f) return
    try {
      await moveFileToTrashPB(id)
      if (previewId === id) setPreviewId(null)
    } catch (error) {
      console.error('Error moving file to trash:', error)
      alert('Error moving file to trash. Please try again.')
    }
  }

  const downloadFile = async (id: string) => {
    const f = files.find((x) => x.id === id)
    if (!f) return

    // If this is a virtual ZIP with entries, build a real ZIP blob before downloading
    const isZip = f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip")
    const hasEntries = Array.isArray(f.archiveEntries) && (f.archiveEntries?.length ?? 0) > 0
    if (isZip && hasEntries) {
      // Minimal ZIP builder (store method, no compression)
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

      // Gather entry data by fetching original blobs
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
        // Fallback: no entries (shouldn't happen), just download existing url
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

      for (const ent of entries) {
        const nameBytes = enc.encode(ent.name)
        const size = ent.data.length
        const crc = crc32(ent.data)
        const { time, date } = toDosTimeDate(ent.modMs)

        // Local file header
        const localHeader = [
          sig(0x04034B50), // signature
          u16(20), // version needed (2.0)
          u16(0), // flags
          u16(0), // method store
          u16(time), u16(date),
          u32(crc), u32(size), u32(size),
          u16(nameBytes.length), u16(0), // fname len, extra len
          nameBytes,
        ]
        const local = concat(localHeader)
        fileParts.push(local)
        fileParts.push(ent.data)

        locals.push({ nameBytes, crc, size, time, date, offset })
        offset += local.length + size
      }

      // Central directory
      for (const l of locals) {
        const centralHeader = [
          sig(0x02014B50), // central signature
          u16(0x0314), // version made by (3.20) arbitrary
          u16(20), // version needed
          u16(0), // flags
          u16(0), // method
          u16(l.time), u16(l.date),
          u32(l.crc), u32(l.size), u32(l.size),
          u16(l.nameBytes.length), u16(0), u16(0), // fname, extra, comment
          u16(0), u16(0), // disk start, internal attrs
          u32(0), // external attrs
          u32(l.offset),
          l.nameBytes,
        ]
        centralParts.push(concat(centralHeader))
      }

      const central = concat(centralParts)
      const endRecord = concat([
        sig(0x06054B50),
        u16(0), u16(0), // disk numbers
        u16(locals.length), u16(locals.length),
        u32(central.length),
        u32(offset),
        u16(0), // comment len
      ])

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

      const zipBytes = concat([concat(fileParts), central, endRecord])
      const zipBlob = new Blob([zipBytes as BlobPart], { type: "application/zip" })
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

    // Default: download existing blob/url
    const a = document.createElement("a")
    a.href = f.url
    a.download = f.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const beginMove = (id: string) => {
    setMovingFileId(id)
    const f = files.find((x) => x.id === id)
    setTargetFolderId(f ? f.folderId : null)
  }
  const commitMove = async () => {
    if (!movingFileId) return
    const dest = targetFolderId ?? null
    // Optimistic UI update
    setFiles((prev) => prev.map((f) => f.id === movingFileId ? { ...f, folderId: dest } : f))
    if (previewId === movingFileId && dest !== currentFolderId) setPreviewId(null)
    // Persist to PocketBase
    await moveFilePB(movingFileId, dest)
    setMovingFileId(null)
  }
  const cancelMove = () => setMovingFileId(null)
  const removeFromFolder = async (id: string) => {
    // Optimistic UI update
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, folderId: null } : f))
    if (previewId === id && currentFolderId !== null) setPreviewId(null)
    // Persist to PocketBase
    await moveFilePB(id, null)
  }

  const toggleFavorite = async (id: string) => {
    const f = files.find((x) => x.id === id)
    if (!f) return
    // Optimistic UI update
    setFiles((prev) => prev.map((x) => x.id === id ? { ...x, favorite: !x.favorite } : x))
    // Persist to PocketBase
    await toggleFileFavoritePB(id, !f.favorite)
  }

  const extractZip = (id: string) => {
    const z = files.find((x) => x.id === id)
    if (!z) return
    const parentId = z.folderId ?? null
    const base = z.name.toLowerCase().endsWith(".zip") ? z.name.slice(0, -4) : z.name
    let name = base || "Extracted"
    const siblingNames = folders.filter((fl) => fl.parentId === parentId).map((fl) => fl.name.toLowerCase())
    if (siblingNames.includes(name.toLowerCase())) {
      let i = 1
      while (siblingNames.includes(`${name} (${i})`.toLowerCase())) i++
      name = `${name} (${i})`
    }
    const rootFolderId = `fld-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const rootFolder: Folder = {
      id: rootFolderId,
      name,
      parentId,
      selected: false,
      favorite: false,
    }

    // Prepare to create nested subfolders and duplicate files
    const newFolders: Folder[] = [rootFolder]
    const createdMap = new Map<string, string>() // key: parentId::name -> folderId
    const newFiles: ManagedFile[] = []

    const ensurePath = (startParentId: string | null, segments: string[]) => {
      let curParent = startParentId !== null ? startParentId : null
      let lastId = rootFolderId
      if (segments.length === 0) return rootFolderId
      for (const seg of segments) {
        const key = `${curParent ?? "root"}::${seg}`
        let childId = createdMap.get(key)
        if (!childId) {
          childId = `fld-${Date.now()}-${Math.random().toString(36).slice(2)}`
          newFolders.push({ id: childId, name: seg, parentId: lastId, selected: false, favorite: false })
          createdMap.set(key, childId)
        }
        lastId = childId
        curParent = childId
      }
      return lastId
    }

    const entries = z.archiveEntries ?? []
    const now = Date.now()
    for (const entry of entries) {
      const orig = files.find((x) => x.id === entry.fileId)
      if (!orig) continue
      const targetFolderId = ensurePath(rootFolderId, entry.path || [])
      const dup: ManagedFile = {
        id: `${orig.id}-copy-${Math.random().toString(36).slice(2)}`,
        name: orig.name,
        size: orig.size,
        type: orig.type,
        url: orig.url,
        lastModified: orig.lastModified,
        folderId: targetFolderId,
        selected: false,
        favorite: false,
        createdAt: now,
        openedAt: null,
        nameModifiedAt: null,
      }
      newFiles.push(dup)
    }

    // Commit changes
    setFolders((prev) => [...newFolders, ...prev])
    if (newFiles.length) setFiles((prev) => [...newFiles, ...prev])
  }

  const beginRename = (id: string) => {
    setRenamingFileId(id)
    const f = files.find((x) => x.id === id)
    setRenameValue(f?.name ?? "")
    setMovingFileId(null)
    setInfoOpenId(null)
  }
  const commitRename = async () => {
    if (!renamingFileId) return
    const val = renameValue.trim()
    if (!val) return
    await renameFilePB(renamingFileId, val)
    setRenamingFileId(null)
  }
  const cancelRename = () => setRenamingFileId(null)

  // Folder actions
  const toggleFolderFavorite = async (id: string) => {
    const fld = folders.find((x) => x.id === id)
    if (!fld) return
    await toggleFolderFavoritePB(id, !fld.favorite)
  }

  const beginFolderRename = (id: string) => {
    setRenamingFolderId(id)
    const fld = folders.find((x) => x.id === id)
    setRenameFolderValue(fld?.name ?? "")
    setMovingFolderId(null)
  }
  const commitFolderRename = async () => {
    if (!renamingFolderId) return
    const val = renameFolderValue.trim()
    if (!val) return
    await renameFolderPB(renamingFolderId, val)
    setRenamingFolderId(null)
  }
  const cancelFolderRename = () => setRenamingFolderId(null)

  const beginFolderMove = (id: string) => {
    setMovingFolderId(id)
    const fld = folders.find((x) => x.id === id)
    setTargetParentId(fld ? fld.parentId : null)
    setRenamingFolderId(null)
  }
  const commitFolderMove = async () => {
    if (!movingFolderId) return
    await moveFolderPB(movingFolderId, targetParentId || null)
    setMovingFolderId(null)
  }
  const cancelFolderMove = () => setMovingFolderId(null)

  const removeFolderFromParent = (id: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, parentId: null } : f))
  }

  const compressFolderToZip = async (id: string) => {
    try {
      await compressFolderToZipPB(id)
    } catch (error) {
      console.error('Failed to compress folder:', error)
      alert('Failed to compress folder. Please try again.')
    }
  }

  const openInfo = (id: string) => {
    setInfoOpenId(id)
    setMovingFileId(null)
    setRenamingFileId(null)
  }
  const closeInfo = () => setInfoOpenId(null)

  const onView = (id: string) => {
    setPreviewId(id)
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, openedAt: Date.now() } : f))
    setPreviewModalOpen(true)
  }

  const previewFile = useMemo(() => files.find((f) => f.id === previewId) || null, [files, previewId])

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

  return (
    <>
    <div className="flex w-full h-full overflow-hidden flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FolderIcon className="w-5 h-5" /> My Vault
        </h2>
      </div>
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => inputRef.current?.click()}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <UploadIcon className="mr-2 h-4 w-4" /> Upload
        </Button>
        <Input
          ref={inputRef}
          type="file"
          multiple
          onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
          className="hidden"
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCreateFolderOpen(true)}>
            <FolderPlusIcon className="mr-2 h-4 w-4" /> Create Folder
          </Button>
          <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Folder</DialogTitle>
                <DialogDescription>Enter a name for your new folder.</DialogDescription>
              </DialogHeader>
              <div className="mt-2 flex flex-col gap-3">
                <Input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      createFolder()
                      setCreateFolderOpen(false)
                    }
                  }}
                  placeholder="New folder name"
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
                  <Button onClick={() => { createFolder(); setCreateFolderOpen(false); }}>Create</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <FilterIcon className="mr-2 h-4 w-4" /> Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={typeFilters.includes("folder")}
                onCheckedChange={() => toggleTypeFilter("folder")}
              >
                Folder
              </DropdownMenuCheckboxItem>
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
        </div>
        <Button variant="outline" onClick={selectAll}>
          {currentFiles.length + childFolders.length > 0 && currentFiles.every((f) => f.selected) && childFolders.every((f) => f.selected) ? (
            <CheckSquareIcon className="mr-2 h-4 w-4" />
          ) : (
            <SquareIcon className="mr-2 h-4 w-4" />
          )}
          Select All
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={!(currentFiles.some((f) => f.selected) || childFolders.some((f) => f.selected))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <TrashIcon className="mr-2 h-4 w-4" /> Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete selected</AlertDialogTitle>
              <AlertDialogDescription>
                Selected files move to Trash. Deleting folders removes files permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteSelected}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" onClick={goUp} disabled={currentFolderId === null}>
          <ChevronLeftIcon className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="ml-auto">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files and folders..."
            className="h-9 w-48 md:w-64"
          />
        </div>
      </div>

      {/* Path */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {getBreadcrumb.map((c, i) => (
          <span key={`${c.id ?? "root"}-${i}`} className="flex items-center">
            <button
              className="rounded px-1 py-0.5 text-foreground hover:bg-muted"
              onClick={() => { setCurrentFolderId(c.id); setPreviewId(null) }}
            >
              {c.name}
            </button>
            {i < getBreadcrumb.length - 1 && <ChevronRightIcon className="mx-1 h-3 w-3" />}
          </span>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="flex min-h-32 w-full items-center justify-center rounded-md border border-dashed border-muted-foreground/40 p-6 text-sm text-muted-foreground"
      >
        Drag & drop files here, or use Upload
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 flex-1 min-h-0">
        {/* Items list */}
        <div className="md:col-span-2 rounded-md border p-2 max-h-[66vh] overflow-y-auto">
          <div className="grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
            <div></div>
            <div>Name</div>
            <div>Size</div>
            <div>Actions</div>
          </div>
          <div className="divide-y">
            {filteredChildFolders.length + filteredFiles.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">{searchQuery ? "No matching items." : "No items here. Upload or create a folder."}</div>
            )}
            {filteredChildFolders.map((f) => (
              <div key={f.id} className="group grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-2 rounded transition-colors hover:bg-muted/50">
                <button
                  onClick={() => toggleSelectFolder(f.id)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                  aria-label={f.selected ? "Unselect" : "Select"}
                >
                  {f.selected ? (
                    <CheckSquareIcon className="h-4 w-4" />
                  ) : (
                    <SquareIcon className="h-4 w-4" />
                  )}
                </button>
                <button className="flex items-center gap-2 truncate text-left" onClick={() => openFolder(f.id)}>
                  <FolderIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  <span className="truncate" title={f.name}>{f.name}</span>
                  {f.favorite && <StarIcon className="h-3 w-3 text-yellow-500 ml-1" aria-label="Favorite" />}
                </button>
                <div className="text-sm text-muted-foreground">{files.filter((x) => x.folderId === f.id).length} items</div>
                <div className="relative flex items-center gap-1">
                  <Button size="sm" variant="outline" className="transition-colors" onClick={() => openFolder(f.id)}>
                    Open
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                        aria-label="Open folder actions menu"
                      >
                        <MoreVerticalIcon className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-lg">
                      <DropdownMenuItem onClick={() => compressFolderToZip(f.id)}>
                        <ArchiveIcon />
                        <span>Compress to ZIP</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteFolder(f.id)}>
                        <TrashIcon />
                        <span>Delete</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleFolderFavorite(f.id)}>
                        {f.favorite ? (
                          <>
                            <StarOffIcon />
                            <span>Remove from Favorites</span>
                          </>
                        ) : (
                          <>
                            <StarIcon />
                            <span>Add to Favorites</span>
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => beginFolderRename(f.id)}>
                        <PencilIcon />
                        <span>Rename</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => beginFolderMove(f.id)}>
                        <FolderIcon />
                        <span>Move</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={f.parentId === null} onClick={() => removeFolderFromParent(f.id)}>
                        <ChevronLeftIcon />
                        <span>Remove from Folder</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {renamingFolderId === f.id && (
                    <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded border bg-background p-2 shadow-lg animate-in fade-in-0 slide-in-from-top-2">
                      <div className="mb-1 text-xs font-medium">Rename folder</div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={renameFolderValue}
                          onChange={(e) => setRenameFolderValue(e.target.value)}
                          autoFocus
                          className="h-8"
                          onKeyDown={(e) => { if (e.key === 'Enter') commitFolderRename(); if (e.key === 'Escape') cancelFolderRename(); }}
                        />
                        <Button size="sm" className="h-8" onClick={commitFolderRename} disabled={!renameFolderValue.trim()}>Apply</Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={cancelFolderRename}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {movingFolderId === f.id && (
                    <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded border bg-background p-2 shadow-lg animate-in fade-in-0 slide-in-from-top-2">
                      <div className="mb-1 text-xs font-medium">Move to</div>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 w-full rounded border bg-background px-2 text-sm"
                          value={targetParentId ?? ''}
                          onChange={(e) => setTargetParentId(e.target.value === '' ? null : e.target.value)}
                        >
                          <option value="">My Vault</option>
                          {folders
                            .filter((fl) => !getDescendantFolderIds(f.id).has(fl.id))
                            .map((fl) => (
                              <option key={fl.id} value={fl.id}>{fl.name}</option>
                            ))}
                        </select>
                        <Button size="sm" className="h-8" onClick={commitFolderMove}>Apply</Button>
                        <Button size="sm" variant="outline" className="h-8" onClick={cancelFolderMove}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredFiles.map((f) => (
              <div key={f.id} className="group grid grid-cols-[24px_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-2 rounded transition-colors hover:bg-muted/50" onMouseEnter={() => setPreviewId(f.id)}>
                <button
                  onClick={() => toggleSelectFile(f.id)}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                  aria-label={f.selected ? "Unselect" : "Select"}
                >
                  {f.selected ? (
                    <CheckSquareIcon className="h-4 w-4" />
                  ) : (
                    <SquareIcon className="h-4 w-4" />
                  )}
                </button>
                <div className="flex items-center gap-2 truncate">
                  {f.type.startsWith("image/") ? (
                    <ImageIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  ) : (
                    <FileIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  )}
                  <span className="truncate" title={f.name}>{f.name}</span>
                  {f.favorite && <StarIcon className="h-3 w-3 text-yellow-500 ml-1" aria-label="Favorite" />}
                </div>
                <div className="text-sm text-muted-foreground">{f.size > 0 ? formatBytes(f.size) : <div className="h-3 w-10 rounded bg-muted animate-pulse" />}</div>
                <div className="relative flex items-center gap-1">
                  <Button size="sm" variant="outline" className="transition-colors" onClick={() => onView(f.id)}>
                    <EyeIcon className="mr-1 h-4 w-4" /> View
                  </Button>
                  <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
                         aria-label="Open actions menu"
                       >
                         <MoreVerticalIcon className="h-4 w-4" />
                         <span className="sr-only">Open menu</span>
                       </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="w-48 rounded-lg">
                       <DropdownMenuItem onClick={() => downloadFile(f.id)}>
                         <DownloadIcon />
                         <span>Download</span>
                       </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => deleteOne(f.id)}>
                        <TrashIcon />
                          <span>Delete</span>
                       </DropdownMenuItem>
                       {(f.type === "application/zip" || f.name.toLowerCase().endsWith(".zip")) && (
                         <DropdownMenuItem onClick={() => extractZip(f.id)}>
                           <ArchiveIcon />
                           <span>Extract All</span>
                         </DropdownMenuItem>
                       )}
                       {/** New actions **/}
                       <DropdownMenuItem onClick={() => toggleFavorite(f.id)}>
                         {f.favorite ? (
                           <>
                             <StarOffIcon />
                             <span>Remove from Favorites</span>
                           </>
                         ) : (
                           <>
                             <StarIcon />
                             <span>Add to Favorites</span>
                           </>
                         )}
                       </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => beginRename(f.id)}>
                         <PencilIcon />
                         <span>Rename</span>
                       </DropdownMenuItem>
                       <DropdownMenuItem onClick={() => openInfo(f.id)}>
                         <InfoIcon />
                         <span>File information</span>
                       </DropdownMenuItem>
                       <DropdownMenuSeparator />
                       <DropdownMenuItem onClick={() => beginMove(f.id)}>
                         <FolderIcon />
                         <span>Move</span>
                       </DropdownMenuItem>
                       <DropdownMenuItem disabled={f.folderId === null} onClick={() => removeFromFolder(f.id)}>
                         <ChevronLeftIcon />
                         <span>Remove from Folder</span>
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>

                   {renamingFileId === f.id && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded border bg-background p-2 shadow-lg animate-in fade-in-0 slide-in-from-top-2">
                        <div className="mb-1 text-xs font-medium">Rename file</div>
                        <div className="flex items-center gap-2">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") cancelRename(); }}
                            className="h-8"
                            autoFocus
                          />
                          <Button size="sm" className="h-8" onClick={commitRename} disabled={!renameValue.trim()}>Apply</Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={cancelRename}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {infoOpenId === f.id && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-[28rem] rounded border bg-background p-3 shadow-lg animate-in fade-in-0 slide-in-from-top-2">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-medium">File information</div>
                          <Button size="sm" variant="outline" className="h-7" onClick={closeInfo}>Close</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          <div className="text-muted-foreground">Type</div>
                          <div className="truncate">{f.type || "Unknown"}</div>
                          <div className="text-muted-foreground">Size</div>
                          <div>{formatBytes(f.size)}</div>
                          <div className="text-muted-foreground">Location</div>
                          <div className="truncate">{f.folderId ? (folders.find((fl) => fl.id === f.folderId)?.name ?? "Unknown") : "None"}</div>
                          <div className="text-muted-foreground">Modified</div>
                          <div>{formatDateTime(Math.max(f.lastModified, f.nameModifiedAt ?? f.lastModified))}</div>
                          <div className="text-muted-foreground">Opened</div>
                          <div>{formatDateTime(f.openedAt)}</div>
                          <div className="text-muted-foreground">Created</div>
                          <div>{formatDateTime(f.createdAt)}</div>
                        </div>
                      </div>
                    )}
                  
                    {movingFileId === f.id && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded border bg-background p-2 shadow-lg animate-in fade-in-0 slide-in-from-top-2">
                        <div className="mb-1 text-xs font-medium">Move to</div>
                        <div className="flex items-center gap-2">
                          <select
                            className="h-8 w-full rounded border bg-background px-2 text-sm"
                            value={targetFolderId ?? ""}
                            onChange={(e) => setTargetFolderId(e.target.value === "" ? null : e.target.value)}
                          >
                            <option value="">My Vault</option>
                            {folders.map((fl) => (
                              <option key={fl.id} value={fl.id}>{fl.name}</option>
                            ))}
                          </select>
                          <Button size="sm" className="h-8" onClick={commitMove}>Apply</Button>
                          <Button size="sm" variant="outline" className="h-8" onClick={cancelMove}>Cancel</Button>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-md border p-3 max-h-[66vh] overflow-y-auto">
          <div className="mb-2 flex items-center justify-between text-sm font-medium">
  <span>Preview</span>
  {previewId && (
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
              {isTextFile(previewFile) ? (
                <div className="rounded border bg-muted/20 p-2">
                  {previewLoading ? (
                    <div className="text-sm text-muted-foreground">Loading text preview…</div>
                  ) : previewError ? (
                    <div className="text-sm text-destructive">{previewError}</div>
                  ) : previewText != null ? (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">{previewText}</pre>
                  ) : (
                    <div className="text-sm text-muted-foreground">No preview available</div>
                  )}
                </div>
              ) : previewFile.type.startsWith("image/") ? (
                <img
                  src={previewFile.url}
                  title={previewFile.name}
                  className="h-64 w-full rounded animate-in fade-in-0 duration-200"
                />
              ) : ((previewFile.type === "application/zip" || previewFile.name.toLowerCase().endsWith(".zip")) && previewFile.archiveEntries) ? (
                <div className="max-h-64 overflow-auto rounded border">
                  <div className="mb-2 text-xs text-muted-foreground">{previewFile.archiveEntries.length} items</div>
                  <div className="divide-y">
                    {previewFile.archiveEntries.map((entry, idx) => {
                      const orig = files.find((x) => x.id === entry.fileId)
                      const displayPath = [...entry.path, orig ? orig.name : "(missing file)"].join("/")
                      return (
                        <div key={`${entry.fileId}-${idx}`} className="flex items-center justify-between px-2 py-1 text-sm">
                          <div className="truncate" title={displayPath}>{displayPath}</div>
                          <div className="ml-2 shrink-0 text-muted-foreground">{orig ? formatBytes(orig.size) : "Unknown"}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : previewFile.type.startsWith("video/") ? (
                <video controls src={previewFile.url} className="h-64 w-full rounded" />
              ) : previewFile.type.startsWith("audio/") ? (
                <audio controls src={previewFile.url} className="w-full" />
              ) : previewFile.type.includes("pdf") ? (
                <iframe src={previewFile.url} title={previewFile.name} className="h-64 w-full rounded" />
              ) : (
                <iframe src={previewFile.url} title={previewFile.name} className="h-64 w-full rounded" />
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name ?? "Preview"}</DialogTitle>
            <DialogDescription></DialogDescription>
          </DialogHeader>
          {previewFile && (
            <div className="space-y-3">
              {isTextFile(previewFile) ? (
                previewLoading ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : previewError ? (
                  <div className="text-sm text-destructive">{previewError}</div>
                ) : (
                  <pre className="max-h-screen w-full overflow-auto rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">{previewText}</pre>
                )
              ) : previewFile.type.startsWith("image/") ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-screen w-full object-contain rounded" />
              ) : ((previewFile.type === "application/zip" || previewFile.name.toLowerCase().endsWith(".zip")) && previewFile.archiveEntries) ? (
                <div className="max-h-screen overflow-auto rounded border">
                  <div className="mb-2 text-xs text-muted-foreground">{previewFile.archiveEntries.length} items</div>
                  <div className="divide-y">
                    {previewFile.archiveEntries.map((entry, idx) => {
                      const orig = files.find((x) => x.id === entry.fileId)
                      const displayPath = [...entry.path, orig ? orig.name : "(missing file)"].join("/")
                      return (
                        <div key={`${entry.fileId}-${idx}`} className="flex items-center justify-between px-2 py-1 text-sm">
                          <div className="truncate" title={displayPath}>{displayPath}</div>
                          <div className="ml-2 shrink-0 text-muted-foreground">{orig ? formatBytes(orig.size) : "Unknown"}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : previewFile.type.startsWith("video/") ? (
                <video controls src={previewFile.url} className="h-96 w-full rounded" />
              ) : previewFile.type.startsWith("audio/") ? (
                <audio controls src={previewFile.url} className="w-full" />
              ) : previewFile.type.includes("pdf") ? (
                <iframe src={previewFile.url} title={previewFile.name} className="h-96 w-full rounded" />
              ) : (
                <iframe src={previewFile.url} title={previewFile.name} className="h-96 w-full rounded" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
