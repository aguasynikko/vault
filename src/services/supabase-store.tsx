import React, { useContext, useEffect, useMemo, useState } from 'react'
import { supabase, hasSupabase } from '@/lib/supabase'
import { FileSystemContext, FileSystemProvider } from '@/services/filesys-store'

// Align shape with ManagedFile used by pages
export type FileItem = {
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
  storagePath: string
}

export type FolderItem = {
  id: string
  name: string
  parentId: string | null
  isFavorite: boolean
  trashedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type SupabaseStore = {
  files: FileItem[]
  folders: FolderItem[]
  refreshData: () => Promise<void>
  uploadFile: (file: File, folderId?: string | null) => Promise<FileItem>
  createFolder: (name: string, parentId?: string | null) => Promise<FolderItem>
  renameFile: (fileId: string, newName: string) => Promise<void>
  toggleFileFavorite: (fileId: string) => Promise<void>
  moveFile: (fileId: string, targetFolderId: string | null) => Promise<void>
  renameFolder: (folderId: string, newName: string) => Promise<void>
  toggleFolderFavorite: (folderId: string) => Promise<void>
  moveFolder: (folderId: string, targetParentId: string | null) => Promise<void>
  moveFileToTrash: (fileId: string) => Promise<void>
  moveFolderToTrash: (folderId: string) => Promise<void>
  restoreFromTrash: (type: 'file' | 'folder', id: string) => Promise<void>
  deleteFromTrashPermanently: (type: 'file' | 'folder', id: string) => Promise<void>
  compressFolderToZip: (folderId: string) => Promise<string>
}

// Reuse the same context as filesys-store so pages can keep using useFileSystem

function SupabaseProviderInternal({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [trash, setTrash] = useState<FileItem[]>([])
  // social/sharing local-only state for compatibility
  const [colleagues, setColleagues] = useState<{ email: string; name?: string; status: 'Friend' | 'Requested'; direction?: 'Incoming' | 'Outgoing' }[]>([])
  const [shares, setShares] = useState<{ itemId: string; itemType: 'file' | 'folder'; sharedWithEmail: string }[]>([])
  const [workspaceInvites, setWorkspaceInvites] = useState<{ email: string; role: 'Member' | 'Viewer' }[]>([])
  const [colleaguesError, setColleaguesError] = useState<string>('')

  const refreshData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    
    const { data: fds, error: ferr } = await supabase
      .from('folders')
      .select('id,name,parent_id,is_favorite,trashed_at,created_at,updated_at')
      .eq('user_id', user.id)
    if (!ferr && fds) {
      setFolders(
        fds.map((r: any) => ({
          id: r.id,
          name: r.name,
          parentId: r.parent_id,
          isFavorite: !!r.is_favorite,
          trashedAt: r.trashed_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      )
    }
    const { data: fis, error: ierr } = await supabase
      .from('files')
      .select('id,name,folder_id,size,mime_type,is_favorite,trashed_at,created_at,updated_at,storage_path')
      .eq('user_id', user.id)
    if (!ierr && fis) {
      const items: FileItem[] = []
      for (const r of fis as any[]) {
        let url = ''
        if (r.storage_path) {
          const signed = await supabase.storage.from('filesys').createSignedUrl(r.storage_path, 3600)
          url = signed.data?.signedUrl || ''
        }
        items.push({
          id: r.id,
          name: r.name,
          size: r.size ?? 0,
          type: r.mime_type ?? 'application/octet-stream',
          url,
          lastModified: Date.parse(r.updated_at ?? r.created_at ?? new Date().toISOString()),
          folderId: r.folder_id,
          selected: false,
          favorite: !!r.is_favorite,
          createdAt: Date.parse(r.created_at ?? new Date().toISOString()),
          openedAt: null,
          nameModifiedAt: null,
          storagePath: r.storage_path,
        })
      }
      setFiles(items)
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await hydrateColleagues(user.id)
    } catch {}
  }

  useEffect(() => {
    refreshData()
    let chan: ReturnType<typeof supabase.channel> | null = null
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const myId = user.id
        chan = supabase
          .channel('colleagues_changes')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'colleagues' }, async (payload: any) => {
            const row = (payload?.new ?? payload?.old) as any
            if (!row) { await hydrateColleagues(myId); return }
            if (row.requester_id === myId || row.recipient_id === myId) {
              await hydrateColleagues(myId)
            }
          })
          .subscribe()
      } catch {}
    })()
    return () => { if (chan) supabase.removeChannel(chan) }
  }, [])

  async function hydrateColleagues(myId: string) {
    const { data: rels, error } = await supabase
      .from('colleagues')
      .select('id,requester_id,recipient_id,status,created_at,updated_at')
      .or(`requester_id.eq.${myId},recipient_id.eq.${myId}`)
    if (error || !rels) {
      return
    }
    const otherIds = rels.map((r: any) => (r.requester_id === myId ? r.recipient_id : r.requester_id))
    const uniq = Array.from(new Set(otherIds))
    const { data: profiles, error: perr } = await supabase
      .from('profiles')
      .select('id,email,name')
      .in('id', uniq)
    if (perr) {
      return
    }
    const byId = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]))
    const mapped = (rels || []).map((r: any) => {
      const otherId = r.requester_id === myId ? r.recipient_id : r.requester_id
      const profile = byId.get(otherId)
      const direction: 'Incoming' | 'Outgoing' = r.recipient_id === myId ? 'Incoming' : 'Outgoing'
      const statusMap: 'Friend' | 'Requested' = r.status === 'accepted' ? 'Friend' : 'Requested'
      return { email: (profile?.email || 'unknown@example.com') as string, name: profile?.name || undefined, status: statusMap, direction }
    })
    setColleagues(mapped)
  }

  const uploadFile = async (file: File, folderId: string | null = null): Promise<FileItem> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const storagePath = `${folderId ?? 'root'}/${Date.now()}-${file.name}`
    const up = await supabase.storage.from('filesys').upload(storagePath, file)
    if (up.error) throw up.error
    const { data, error } = await supabase
      .from('files')
      .insert({ user_id: user.id, name: file.name, folder_id: folderId, size: file.size, mime_type: file.type, storage_path: storagePath })
      .select()
      .single()
    if (error) throw error
    const signed = await supabase.storage.from('filesys').createSignedUrl(storagePath, 3600)
    const item: FileItem = {
      id: data.id,
      name: data.name,
      size: data.size ?? 0,
      type: data.mime_type ?? 'application/octet-stream',
      url: signed.data?.signedUrl || '',
      lastModified: Date.parse(data.updated_at ?? data.created_at ?? new Date().toISOString()),
      folderId: data.folder_id,
      selected: false,
      favorite: !!data.is_favorite,
      createdAt: Date.parse(data.created_at ?? new Date().toISOString()),
      openedAt: null,
      nameModifiedAt: null,
      storagePath: data.storage_path,
    }
    setFiles((prev) => [item, ...prev])
    return item
  }

  const createFolder = async (name: string, parentId: string | null = null): Promise<FolderItem> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    const { data, error } = await supabase
      .from('folders')
      .insert({ user_id: user.id, name, parent_id: parentId })
      .select()
      .single()
    if (error) throw error
    const folder: FolderItem = {
      id: data.id,
      name: data.name,
      parentId: data.parent_id,
      isFavorite: !!data.is_favorite,
      trashedAt: data.trashed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
    setFolders((prev) => [folder, ...prev])
    return folder
  }

  const renameFile = async (fileId: string, newName: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('files').update({ name: newName }).eq('id', fileId).eq('user_id', user.id)
    if (error) throw error
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, name: newName } : f)))
  }

  const toggleFileFavorite = async (fileId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const target = files.find((f) => f.id === fileId)
    const next = !target?.favorite
    const { error } = await supabase.from('files').update({ is_favorite: next }).eq('id', fileId).eq('user_id', user.id)
    if (error) throw error
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, favorite: next } : f)))
  }

  const moveFile = async (fileId: string, targetFolderId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('files').update({ folder_id: targetFolderId }).eq('id', fileId).eq('user_id', user.id)
    if (error) throw error
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, folderId: targetFolderId } : f)))
  }

  const renameFolder = async (folderId: string, newName: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('folders').update({ name: newName }).eq('id', folderId).eq('user_id', user.id)
    if (error) throw error
    setFolders((prev) => prev.map((d) => (d.id === folderId ? { ...d, name: newName } : d)))
  }

  const toggleFolderFavorite = async (folderId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const target = folders.find((d) => d.id === folderId)
    const next = !target?.isFavorite
    const { error } = await supabase.from('folders').update({ is_favorite: next }).eq('id', folderId).eq('user_id', user.id)
    if (error) throw error
    setFolders((prev) => prev.map((d) => (d.id === folderId ? { ...d, isFavorite: next } : d)))
  }

  const moveFolder = async (folderId: string, targetParentId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('folders').update({ parent_id: targetParentId }).eq('id', folderId).eq('user_id', user.id)
    if (error) throw error
    setFolders((prev) => prev.map((d) => (d.id === folderId ? { ...d, parentId: targetParentId } : d)))
  }

  const moveFileToTrash = async (fileId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('files').update({ trashed_at: new Date().toISOString() }).eq('id', fileId).eq('user_id', user.id)
    if (error) throw error
    const target = files.find((f) => f.id === fileId)
    if (target) setTrash((prev) => [...prev, { ...target, selected: false }])
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const moveFolderToTrash = async (folderId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('folders').update({ trashed_at: new Date().toISOString() }).eq('id', folderId).eq('user_id', user.id)
    if (error) throw error
    // represent folder as ManagedFile in trash for UI compatibility
    const folder = folders.find((d) => d.id === folderId)
    if (folder) {
      const folderAsFile: FileItem = {
        id: folder.id,
        name: folder.name,
        size: 0,
        type: 'folder',
        url: '',
        lastModified: Date.now(),
        folderId: null,
        selected: false,
        favorite: !!folder.isFavorite,
        createdAt: Date.now(),
        openedAt: null,
        nameModifiedAt: null,
        storagePath: ''
      }
      setTrash((prev) => [...prev, folderAsFile])
    }
    setFolders((prev) => prev.filter((d) => d.id !== folderId))
  }

  const restoreFromTrashApi = async (type: 'file' | 'folder', id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from(type === 'file' ? 'files' : 'folders').update({ trashed_at: null }).eq('id', id).eq('user_id', user.id)
    if (error) throw error
    if (type === 'file') {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, trashedAt: null } : f)))
    } else {
      setFolders((prev) => prev.map((d) => (d.id === id ? { ...d, trashedAt: null } : d)))
    }
  }

  const deleteFromTrashPermanently = async (type: 'file' | 'folder', id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    if (type === 'file') {
      const target = files.find((f) => f.id === id)
      if (target?.storagePath) {
        await supabase.storage.from('filesys').remove([target.storagePath])
      }
    }
    const { error } = await supabase.from(type === 'file' ? 'files' : 'folders').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    if (type === 'file') {
      setTrash((prev) => prev.filter((t) => t.id !== id))
    } else {
      setTrash((prev) => prev.filter((t) => t.id !== id))
    }
  }

  const compressFolderToZip = async (folderId: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    // Placeholder: serverless zip not directly available; return list URL
    // In practice, you would trigger an Edge Function to zip and return a URL.
    const { data, error } = await supabase.from('folders').select('name').eq('id', folderId).eq('user_id', user.id).single()
    if (error) throw error
    return `Folder-${data.name}-compressed.zip` // UI placeholder
  }

  // Deletions (compatibility)
  const deleteFile = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const target = files.find((f) => f.id === id)
    if (target?.storagePath) await supabase.storage.from('filesys').remove([target.storagePath])
    const { error } = await supabase.from('files').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const deleteFolderCascade = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    await supabase.from('files').delete().eq('folder_id', id).eq('user_id', user.id)
    await supabase.from('folders').delete().eq('id', id).eq('user_id', user.id)
    setFiles((prev) => prev.filter((f) => f.folderId !== id))
    setFolders((prev) => prev.filter((d) => d.id !== id))
  }

  const addColleagueFriend = async (email: string, name?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      
      // Prevent adding yourself
      if (user.email?.toLowerCase() === email.toLowerCase()) {
        throw new Error('You cannot add yourself as a colleague')
      }
      
      const myId = user.id
      const { data: recs, error: rerr } = await supabase
        .from('profiles')
        .select('id,email,name')
        .ilike('email', email.trim())
        .limit(1)
      
      if (rerr) throw rerr
      const recipient = (Array.isArray(recs) && recs.length > 0) ? recs[0] : null
      if (!recipient) throw new Error(`User with email "${email}" not found. Make sure they have signed up.`)
      
      // Check if request already exists
      const { data: existing } = await supabase
        .from('colleagues')
        .select('id')
        .or(`and(requester_id.eq.${myId},recipient_id.eq.${recipient.id}),and(requester_id.eq.${recipient.id},recipient_id.eq.${myId})`)
        .limit(1)
      
      if (existing && existing.length > 0) {
        throw new Error('You already have a connection with this user')
      }
      
      const { error: iErr } = await supabase
        .from('colleagues')
        .insert({ requester_id: myId, recipient_id: recipient.id, status: 'requested' })
      if (iErr) throw iErr
      
      setColleaguesError('')
      setColleagues((prev) => {
        if (prev.some((c) => c.email === email)) return prev
        return [...prev, { email, name: name || recipient.name || email.split('@')[0], status: 'Requested', direction: 'Outgoing' }]
      })
    } catch (e) {
      const errorMsg = (e as any)?.message || 'Failed to send request'
      console.warn('addColleagueFriend error', e)
      setColleaguesError(errorMsg)
    }
  }

  const acceptColleagueRequest = async (email: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const myId = user.id
      
      const { data: reqs, error: perr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email.trim())
        .limit(1)
      if (perr) throw perr
      
      const requester = (Array.isArray(reqs) && reqs.length > 0) ? reqs[0] : null
      if (!requester) throw new Error('User not found')
      
      const { error } = await supabase
        .from('colleagues')
        .update({ status: 'accepted' })
        .eq('recipient_id', myId)
        .eq('requester_id', requester.id)
      
      if (error) throw error
      setColleaguesError('')
      setColleagues((prev) => prev.map((c) => c.email === email ? { ...c, status: 'Friend', direction: undefined } : c))
    } catch (e) {
      const errorMsg = (e as any)?.message || 'Failed to accept request'
      console.warn('acceptColleagueRequest error', e)
      setColleaguesError(errorMsg)
    }
  }

  const rejectColleagueRequest = async (email: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const myId = user.id
      
      const { data: reqs, error: perr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email.trim())
        .limit(1)
      if (perr) throw perr
      
      const requester = (Array.isArray(reqs) && reqs.length > 0) ? reqs[0] : null
      if (!requester) throw new Error('User not found')
      
      const { error } = await supabase
        .from('colleagues')
        .delete()
        .eq('recipient_id', myId)
        .eq('requester_id', requester.id)
      
      if (error) throw error
      setColleaguesError('')
      setColleagues((prev) => prev.filter((c) => c.email !== email))
    } catch (e) {
      const errorMsg = (e as any)?.message || 'Failed to reject request'
      console.warn('rejectColleagueRequest error', e)
      setColleaguesError(errorMsg)
    }
  }

  const removeColleague = async (email: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const myId = user.id
      const { data: others, error: oerr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email.trim())
        .limit(1)
      if (oerr) throw oerr
      const other = (Array.isArray(others) && others.length > 0) ? others[0] : null
      if (!other) throw new Error('Profile not found')
      // Delete relationship regardless of direction
      await supabase
        .from('colleagues')
        .delete()
        .or(`and(requester_id.eq.${myId},recipient_id.eq.${other.id}),and(requester_id.eq.${other.id},recipient_id.eq.${myId})`)
    } catch (e) {
      console.warn('removeColleague error', e)
    }
    setColleagues((prev) => prev.filter((c) => c.email !== email))
  }

  const createShares = async (entries: { itemId: string; itemType: 'file' | 'folder'; sharedWithEmail: string }[]) => {
    setShares((prev) => [...prev, ...entries])
  }

  const inviteToWorkspace = async (invite: { email: string; role: 'Member' | 'Viewer' }) => {
    setWorkspaceInvites((prev) => {
      if (prev.some((i) => i.email === invite.email)) return prev
      return [...prev, invite]
    })
  }

  const removeWorkspaceInvite = async (email: string) => {
    setWorkspaceInvites((prev) => prev.filter((i) => i.email !== email))
  }

  const value: any = useMemo(() => ({
    files,
    folders: folders.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, selected: false, favorite: !!d.isFavorite })),
    trash,
    setFiles: setFiles as any,
    setFolders: (fn: any) => setFolders((prev) => {
      const mapped = prev.map((d) => ({ id: d.id, name: d.name, parentId: d.parentId, selected: false, favorite: !!d.isFavorite }))
      const next = typeof fn === 'function' ? fn(mapped) : fn
      // Map back to FolderItem
      return next.map((d: any) => ({ id: d.id, name: d.name, parentId: d.parentId, isFavorite: !!d.favorite, trashedAt: null, createdAt: '', updatedAt: '' }))
    }) as any,
    setTrash: setTrash as any,
    colleagues,
    setColleagues,
    shares,
    setShares,
    workspaceInvites,
    setWorkspaceInvites,
    colleaguesError,
    refreshData,
    uploadFile: async (file: File, folderId?: string) => { await uploadFile(file, folderId ?? null); },
    createFolder: async (name?: string, parentId?: string | null) => { await createFolder(name || 'New Folder', parentId ?? null); },
    renameFile: async (id: string, name: string) => { await renameFile(id, name) },
    toggleFileFavorite: async (id: string, value: boolean) => { if (value) { const t = files.find(f=>f.id===id); if (!t?.favorite) await toggleFileFavorite(id) } else { const t = files.find(f=>f.id===id); if (t?.favorite) await toggleFileFavorite(id) } },
    deleteFile,
    moveFile: async (id: string, folderId: string | null) => { await moveFile(id, folderId) },
    renameFolder: async (id: string, name: string) => { await renameFolder(id, name) },
    toggleFolderFavorite: async (id: string, value: boolean) => { const t = folders.find(d=>d.id===id); const next = !!value; if ((t?.isFavorite||false) !== next) await toggleFolderFavorite(id) },
    moveFolder: async (id: string, parentId: string | null) => { await moveFolder(id, parentId) },
    deleteFolderCascade,
    moveFileToTrash: async (id: string) => { await moveFileToTrash(id) },
    moveFolderToTrash: async (id: string) => { await moveFolderToTrash(id) },
    restoreFromTrash: async (itemId: string) => { const item = trash.find(t=>t.id===itemId); if (!item) return; if (item.type==='folder') { await restoreFromTrashApi('folder', itemId) } else { await restoreFromTrashApi('file', itemId) } },
    deleteFromTrashPermanently: async (itemId: string) => { const item = trash.find(t=>t.id===itemId); if (!item) return; await deleteFromTrashPermanently(item.type==='folder'?'folder':'file', itemId) },
    addColleagueFriend,
    acceptColleagueRequest,
    rejectColleagueRequest,
    removeColleague,
    createShares,
    inviteToWorkspace,
    removeWorkspaceInvite,
    compressFolderToZip: async (folderId: string) => { await compressFolderToZip(folderId) },
  }), [files, folders, trash, colleagues, shares, workspaceInvites])

  return <FileSystemContext.Provider value={value}>{children}</FileSystemContext.Provider>
}

export function useSupabaseStore() {
  const ctx = useContext(FileSystemContext)
  if (!ctx) throw new Error('useSupabaseStore must be used within SupabaseProvider')
  return ctx
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  if (!hasSupabase) {
    return <FileSystemProvider>{children}</FileSystemProvider>
  }
  return <SupabaseProviderInternal>{children}</SupabaseProviderInternal>
}
