import React, { createContext, useContext, useEffect, useState } from "react"

export type Folder = {
  id: string
  name: string
  parentId: string | null
  selected: boolean
  favorite: boolean
}

export type ManagedFile = {
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
  archiveOfFolderId?: string | null
  archiveEntries?: { fileId: string; path: string[] }[]
}

// New: social/sharing types
export type Colleague = {
  email: string
  name?: string
  status: "Friend" | "Requested"
  // Whether this request came to the current user or was sent by them
  direction?: "Incoming" | "Outgoing"
}

export type ShareEntry = {
  itemId: string
  itemType: "file" | "folder"
  sharedWithEmail: string
}

export type WorkspaceInvite = {
  email: string
  role: "Member" | "Viewer"
}

export type FileSystemStore = {
  files: ManagedFile[]
  folders: Folder[]
  trash: ManagedFile[]
  setFiles: React.Dispatch<React.SetStateAction<ManagedFile[]>>
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>
  setTrash: React.Dispatch<React.SetStateAction<ManagedFile[]>>
  // social/sharing in store
  colleagues: Colleague[]
  setColleagues: React.Dispatch<React.SetStateAction<Colleague[]>>
  shares: ShareEntry[]
  setShares: React.Dispatch<React.SetStateAction<ShareEntry[]>>
  workspaceInvites: WorkspaceInvite[]
  setWorkspaceInvites: React.Dispatch<React.SetStateAction<WorkspaceInvite[]>>
  // operations (local implementations replacing PocketBase APIs)
  refreshData: () => void
  uploadFile: (file: File, folderId?: string) => Promise<void>
  createFolder: (name?: string, parentId?: string | null) => Promise<void>
  renameFile: (id: string, name: string) => Promise<void>
  toggleFileFavorite: (id: string, value: boolean) => Promise<void>
  deleteFile: (id: string) => Promise<void>
  moveFile: (id: string, folderId: string | null) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  toggleFolderFavorite: (id: string, value: boolean) => Promise<void>
  moveFolder: (id: string, parentId: string | null) => Promise<void>
  deleteFolderCascade: (id: string) => Promise<void>
  moveFileToTrash: (id: string) => Promise<void>
  moveFolderToTrash: (id: string) => Promise<void>
  restoreFromTrash: (itemId: string) => Promise<void>
  deleteFromTrashPermanently: (itemId: string) => Promise<void>
  addColleagueFriend: (email: string, name?: string) => Promise<void>
  acceptColleagueRequest: (email: string) => Promise<void>
  rejectColleagueRequest: (email: string) => Promise<void>
  removeColleague: (email: string) => Promise<void>
  createShares: (entries: ShareEntry[]) => Promise<void>
  inviteToWorkspace: (invite: WorkspaceInvite) => Promise<void>
  removeWorkspaceInvite: (email: string) => Promise<void>
  compressFolderToZip: (folderId: string) => Promise<void>
}

export const FileSystemContext = createContext<FileSystemStore | null>(null)

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<ManagedFile[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [trash, setTrash] = useState<ManagedFile[]>([])
  // New: social/sharing state
  const [colleagues, setColleagues] = useState<Colleague[]>([])
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInvite[]>([])

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const rawFolders = localStorage.getItem("filesys/folders")
      const rawFiles = localStorage.getItem("filesys/files")
      const rawTrash = localStorage.getItem("filesys/trash")
      // New persisted keys
      const rawColleagues = localStorage.getItem("filesys/colleagues")
      const rawShares = localStorage.getItem("filesys/shares")
      const rawWorkspaceInvites = localStorage.getItem("filesys/workspaceInvites")
      if (rawFolders) {
        const parsed = JSON.parse(rawFolders)
        if (Array.isArray(parsed)) setFolders(parsed as Folder[])
      }
      if (rawFiles) {
        const parsed = JSON.parse(rawFiles)
        if (Array.isArray(parsed)) setFiles(parsed as ManagedFile[])
      }
      if (rawTrash) {
        const parsed = JSON.parse(rawTrash)
        if (Array.isArray(parsed)) setTrash(parsed as ManagedFile[])
      }
      if (rawColleagues) {
        const parsed = JSON.parse(rawColleagues)
        if (Array.isArray(parsed)) setColleagues(parsed as Colleague[])
      }
      if (rawShares) {
        const parsed = JSON.parse(rawShares)
        if (Array.isArray(parsed)) setShares(parsed as ShareEntry[])
      }
      if (rawWorkspaceInvites) {
        const parsed = JSON.parse(rawWorkspaceInvites)
        if (Array.isArray(parsed)) setWorkspaceInvites(parsed as WorkspaceInvite[])
      }
    } catch (e) {
      console.warn("Failed to load persisted store", e)
    }
  }, [])

  // Persist whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("filesys/folders", JSON.stringify(folders))
    } catch (e) {
      console.warn("Failed to persist folders", e)
    }
  }, [folders])

  useEffect(() => {
    try {
      localStorage.setItem("filesys/files", JSON.stringify(files))
    } catch (e) {
      console.warn("Failed to persist files", e)
    }
  }, [files])

  useEffect(() => {
    try {
      localStorage.setItem("filesys/trash", JSON.stringify(trash))
    } catch (e) {
      console.warn("Failed to persist trash", e)
    }
  }, [trash])

  // New persists
  useEffect(() => {
    try {
      localStorage.setItem("filesys/colleagues", JSON.stringify(colleagues))
    } catch (e) {
      console.warn("Failed to persist colleagues", e)
    }
  }, [colleagues])

  useEffect(() => {
    try {
      localStorage.setItem("filesys/shares", JSON.stringify(shares))
    } catch (e) {
      console.warn("Failed to persist shares", e)
    }
  }, [shares])

  useEffect(() => {
    try {
      localStorage.setItem("filesys/workspaceInvites", JSON.stringify(workspaceInvites))
    } catch (e) {
      console.warn("Failed to persist workspaceInvites", e)
    }
  }, [workspaceInvites])

  // Helpers
  const genId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
  const refreshData = () => {
    // For local store, nothing to fetch; we could reload persisted state if needed.
    try {
      const rawFolders = localStorage.getItem("filesys/folders")
      const rawFiles = localStorage.getItem("filesys/files")
      const rawTrash = localStorage.getItem("filesys/trash")
      const rawColleagues = localStorage.getItem("filesys/colleagues")
      const rawShares = localStorage.getItem("filesys/shares")
      const rawWorkspaceInvites = localStorage.getItem("filesys/workspaceInvites")
      if (rawFolders) setFolders(JSON.parse(rawFolders) || [])
      if (rawFiles) setFiles(JSON.parse(rawFiles) || [])
      if (rawTrash) setTrash(JSON.parse(rawTrash) || [])
      if (rawColleagues) setColleagues(JSON.parse(rawColleagues) || [])
      if (rawShares) setShares(JSON.parse(rawShares) || [])
      if (rawWorkspaceInvites) setWorkspaceInvites(JSON.parse(rawWorkspaceInvites) || [])
    } catch {}
  }

  // Operations
  const uploadFile = async (file: File, folderId?: string) => {
    const id = genId()
    const now = Date.now()
    const url = URL.createObjectURL(file)
    setFiles((prev) => [
      ...prev,
      {
        id,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        url,
        lastModified: file.lastModified || now,
        folderId: folderId ?? null,
        selected: false,
        favorite: false,
        createdAt: now,
        openedAt: null,
        nameModifiedAt: null,
        archiveOfFolderId: null,
        archiveEntries: [],
      },
    ])
  }

  const createFolder = async (name = "New Folder", parentId: string | null = null) => {
    const id = genId()
    setFolders((prev) => [
      ...prev,
      { id, name, parentId, selected: false, favorite: false },
    ])
  }

  const renameFile = async (id: string, name: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, name, nameModifiedAt: Date.now() } : f)))
  }

  const toggleFileFavorite = async (id: string, value: boolean) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, favorite: value } : f)))
  }

  const deleteFile = async (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const moveFile = async (id: string, folderId: string | null) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, folderId } : f)))
  }

  const renameFolder = async (id: string, name: string) => {
    setFolders((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)))
  }

  const toggleFolderFavorite = async (id: string, value: boolean) => {
    setFolders((prev) => prev.map((d) => (d.id === id ? { ...d, favorite: value } : d)))
  }

  const moveFolder = async (id: string, parentId: string | null) => {
    setFolders((prev) => prev.map((d) => (d.id === id ? { ...d, parentId } : d)))
  }

  const deleteFolderCascade = async (id: string) => {
    // delete files in folder
    setFiles((prev) => prev.filter((f) => f.folderId !== id))
    // recursively delete subfolders
    const subfolderIds = new Set<string>()
    const collectSubs = (parent: string) => {
      folders.filter((d) => d.parentId === parent).forEach((sf) => {
        subfolderIds.add(sf.id)
        collectSubs(sf.id)
      })
    }
    collectSubs(id)
    setFolders((prev) => prev.filter((d) => d.id !== id && !subfolderIds.has(d.id)))
  }

  const moveFileToTrash = async (id: string) => {
    const file = files.find((f) => f.id === id)
    if (!file) return
    setTrash((prev) => [
      ...prev,
      { ...file, selected: false },
    ])
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const moveFolderToTrash = async (id: string) => {
    const folder = folders.find((d) => d.id === id)
    if (!folder) return
    // Move contained files to trash
    const filesInFolder = files.filter((f) => f.folderId === id)
    for (const f of filesInFolder) {
      await moveFileToTrash(f.id)
    }
    // Move subfolders recursively
    const subfolders = folders.filter((d) => d.parentId === id)
    for (const sf of subfolders) {
      await moveFolderToTrash(sf.id)
    }
    // Represent folder as ManagedFile in trash
    const folderAsFile: ManagedFile = {
      id: folder.id,
      name: folder.name,
      size: 0,
      type: "folder",
      url: "",
      lastModified: Date.now(),
      folderId: null,
      selected: false,
      favorite: folder.favorite || false,
      createdAt: Date.now(),
      openedAt: null,
      nameModifiedAt: null,
      archiveOfFolderId: null,
      archiveEntries: [],
    }
    setTrash((prev) => [...prev, folderAsFile])
    setFolders((prev) => prev.filter((d) => d.id !== id))
  }

  const restoreFromTrash = async (itemId: string) => {
    const item = trash.find((t) => t.id === itemId)
    if (!item) return
    if (item.type === "folder") {
      setFolders((prev) => [
        ...prev,
        { id: item.id, name: item.name, parentId: null, selected: false, favorite: item.favorite || false },
      ])
    } else {
      setFiles((prev) => [
        ...prev,
        { ...item, selected: false },
      ])
    }
    setTrash((prev) => prev.filter((t) => t.id !== itemId))
  }

  const deleteFromTrashPermanently = async (itemId: string) => {
    setTrash((prev) => prev.filter((t) => t.id !== itemId))
  }

  const addColleagueFriend = async (email: string, name?: string) => {
    setColleagues((prev) => {
      if (prev.some((c) => c.email === email)) return prev
      // Local mode: treat as a pending outgoing request first
      return [...prev, { email, name, status: "Requested", direction: "Outgoing" }]
    })
  }

  const acceptColleagueRequest = async (email: string) => {
    setColleagues((prev) => {
      const idx = prev.findIndex((c) => c.email === email)
      if (idx === -1) return prev
      const cur = prev[idx]
      const next = { ...cur, status: "Friend" as const, direction: undefined }
      const copy = prev.slice()
      copy[idx] = next
      return copy
    })
  }

  const rejectColleagueRequest = async (email: string) => {
    setColleagues((prev) => prev.filter((c) => c.email !== email))
  }

  const removeColleague = async (email: string) => {
    setColleagues((prev) => prev.filter((c) => c.email !== email))
  }

  const createShares = async (entries: ShareEntry[]) => {
    setShares((prev) => [...prev, ...entries])
  }

  const inviteToWorkspace = async (invite: WorkspaceInvite) => {
    setWorkspaceInvites((prev) => {
      if (prev.some((i) => i.email === invite.email)) return prev
      return [...prev, invite]
    })
  }

  const removeWorkspaceInvite = async (email: string) => {
    setWorkspaceInvites((prev) => prev.filter((i) => i.email !== email))
  }

  const compressFolderToZip = async (folderId: string) => {
    const folder = folders.find((d) => d.id === folderId)
    if (!folder) return
    const id = genId()
    const now = Date.now()
    const contained = files.filter((f) => f.folderId === folderId)
    const archiveEntries = contained.map((f) => ({ fileId: f.id, path: [folder.name, f.name] }))
    setFiles((prev) => [
      ...prev,
      {
        id,
        name: `${folder.name}.zip`,
        size: 0,
        type: "application/zip",
        url: "",
        lastModified: now,
        folderId: folder.parentId || null,
        selected: false,
        favorite: false,
        createdAt: now,
        openedAt: null,
        nameModifiedAt: null,
        archiveOfFolderId: folderId,
        archiveEntries,
      },
    ])
  }

  return (
    <FileSystemContext.Provider
      value={{
        files,
        folders,
        trash,
        setFiles,
        setFolders,
        setTrash,
        colleagues,
        setColleagues,
        shares,
        setShares,
        workspaceInvites,
        setWorkspaceInvites,
        refreshData,
        uploadFile,
        createFolder,
        renameFile,
        toggleFileFavorite,
        deleteFile,
        moveFile,
        renameFolder,
        toggleFolderFavorite,
        moveFolder,
        deleteFolderCascade,
        moveFileToTrash,
        moveFolderToTrash,
        restoreFromTrash,
        deleteFromTrashPermanently,
        addColleagueFriend,
        acceptColleagueRequest,
        rejectColleagueRequest,
        removeColleague,
        createShares,
        inviteToWorkspace,
        removeWorkspaceInvite,
        compressFolderToZip,
      }}
    >
      {children}
    </FileSystemContext.Provider>
  )
}

export function useFileSystem() {
  const ctx = useContext(FileSystemContext)
  if (!ctx) throw new Error("useFileSystem must be used within FileSystemProvider")
  return ctx
}

// Compatibility: expose the same hook name used by pages
export const usePocketBase = useFileSystem
