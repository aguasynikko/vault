import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { UsersIcon, MailIcon, UserPlusIcon, TrashIcon, MoreVerticalIcon, Share2Icon, FolderIcon, FileIcon } from "lucide-react"
import { usePocketBase } from "@/services/filesys-store"
import type { ManagedFile, Colleague, ShareEntry, WorkspaceInvite } from "@/services/filesys-store"
import { useAuth } from "@/contexts/AuthContext"

export default function ColleaguesPage() {

  const { files, folders, colleagues, addColleagueFriend, acceptColleagueRequest, rejectColleagueRequest, removeColleague, createShares, inviteToWorkspace, refreshData, colleaguesError } = usePocketBase() as {
    files: ManagedFile[]
    folders: { id: string; name: string; parentId?: string | null }[]
    colleagues: Colleague[]
    addColleagueFriend: (email: string, name?: string) => Promise<void>
    acceptColleagueRequest: (email: string) => Promise<void>
    rejectColleagueRequest: (email: string) => Promise<void>
    removeColleague: (email: string) => Promise<void>
    createShares: (entries: ShareEntry[]) => Promise<void>
    inviteToWorkspace: (invite: WorkspaceInvite) => Promise<void>
    refreshData: () => void | Promise<void>
    colleaguesError?: string
  }
  useAuth()

  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return colleagues.filter(c => !q || (c.email.toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q)))
  }, [colleagues, query])

  // Incoming friend requests
  const incomingRequests = useMemo(() => {
    return colleagues.filter(c => c.status === "Requested" && c.direction === "Incoming")
  }, [colleagues])

  // Email search & add friend
  const [searchEmail, setSearchEmail] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const isValidEmail = (e: string) => /.+@.+\..+/.test(e)
  const [newFriendName, setNewFriendName] = useState("")

  const addFriend = async () => {
    const email = searchEmail.trim()
    if (!isValidEmail(email)) return
    const name = newFriendName.trim() || email.split("@")[0]
    await addColleagueFriend(email, name)
    await Promise.resolve(refreshData())
    setSearchEmail(""); setNewFriendName(""); setSearchOpen(false)
  }

  // Share items with colleague
  type ShareSelection = { [id: string]: boolean }
  const [shareForEmail, setShareForEmail] = useState<string | null>(null)
  const [shareFilesSel, setShareFilesSel] = useState<ShareSelection>({})
  const [shareFoldersSel, setShareFoldersSel] = useState<ShareSelection>({})

  // Helper: determine if a folder id belongs to a workspace (exclude from My Vault shares)
  const isWorkspaceFolderId = (fid: string | null): boolean => {
    if (!fid) return false
    let cur: any = folders.find((f: any) => f.id === fid)
    while (cur) {
      if (cur.parentId === "workspace-root") return true
      cur = cur.parentId ? folders.find((f: any) => f.id === cur.parentId) : null
    }
    return false
  }

  const vaultFilesForShare = useMemo(() => {
    return files.filter(f => !isWorkspaceFolderId(f.folderId)).slice(0, 50)
  }, [files, folders])

  const vaultFoldersForShare = useMemo(() => {
    return (folders as any[]).filter((d) => !isWorkspaceFolderId(d.id)).slice(0, 50)
  }, [folders])

  const toggleSel = (map: ShareSelection, id: string, setter: (v: ShareSelection) => void) => setter({ ...map, [id]: !map[id] })
  const confirmShare = async () => {
    const email = shareForEmail
    if (!email) return
    const chosenFileIds = Object.keys(shareFilesSel).filter(id => shareFilesSel[id])
    const chosenFolderIds = Object.keys(shareFoldersSel).filter(id => shareFoldersSel[id])
    if (chosenFileIds.length === 0 && chosenFolderIds.length === 0) return
    const entries: ShareEntry[] = [
      ...chosenFileIds.map(id => ({ itemId: id, itemType: "file", sharedWithEmail: email } as ShareEntry)),
      ...chosenFolderIds.map(id => ({ itemId: id, itemType: "folder", sharedWithEmail: email } as ShareEntry)),
    ]
    await createShares(entries)
    setShareForEmail(null)
    setShareFilesSel({})
    setShareFoldersSel({})
  }

  const handleInviteToWorkspace = async (email: string) => {
    const payload: WorkspaceInvite = { email, role: "Member" }
    await inviteToWorkspace(payload)
  }




  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <UsersIcon className="w-5 h-5" /> Colleagues
        </h2>
        <div className="flex items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="w-56" />
          <Button variant="outline" onClick={() => { refreshData() }}>Refresh</Button>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button><UserPlusIcon className="mr-2 h-4 w-4" /> Find by Email</Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-2">
                <div className="space-y-1">
                  <Label htmlFor="colleague-email">Email</Label>
                  <Input id="colleague-email" value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder="name@example.com" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="colleague-name">Name (optional)</Label>
                  <Input id="colleague-name" value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} placeholder="e.g. Alex" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => { setSearchOpen(false); setSearchEmail(""); setNewFriendName("") }}>Cancel</Button>
                  <Button onClick={addFriend} disabled={!isValidEmail(searchEmail)}>Send Request</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {colleaguesError && (
        <div className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {colleaguesError}
        </div>
      )}

      {/* Incoming requests section */}
      {incomingRequests.length > 0 && (
        <div className="rounded border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Friend Requests</div>
            <div className="text-xs text-muted-foreground">{incomingRequests.length} pending</div>
          </div>
          <div className="grid gap-2">
            {incomingRequests.map((c) => (
              <div key={c.email} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm" title={c.name || c.email}>{c.name || c.email}</span>
                    <span className="text-xs text-muted-foreground" title={c.email}>{c.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="default" onClick={() => acceptColleagueRequest(c.email)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => rejectColleagueRequest(c.email)}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Colleagues list */}
      <div className="rounded border">
        <div className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          <div className="col-span-4">Name</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">No colleagues yet. Add one using the button above.</div>
        ) : (
          <div className="divide-y">
            {filtered.map(c => (
              <div key={c.email} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                <div className="col-span-4 flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate" title={c.name || c.email}>{c.name || c.email}</span>
                </div>
                <div className="col-span-4 flex items-center gap-2 text-muted-foreground">
                  <MailIcon className="h-4 w-4" />
                  <span className="truncate" title={c.email}>{c.email}</span>
                </div>
                <div className="col-span-2">
                  {c.status}
                  {c.status === "Requested" && c.direction === "Outgoing" && (
                    <span className="ml-1 text-xs text-muted-foreground">(pending)</span>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {c.status === "Requested" && c.direction === "Incoming" ? (
                    <>
                      <Button size="sm" variant="default" onClick={() => acceptColleagueRequest(c.email)}>Accept</Button>
                      <Button size="sm" variant="outline" onClick={() => rejectColleagueRequest(c.email)}>Decline</Button>
                    </>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreVerticalIcon className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setShareForEmail(c.email) }}>
                        <Share2Icon className="mr-2 h-4 w-4" /> Share Files/Folders
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleInviteToWorkspace(c.email)}>
                        <FolderIcon className="mr-2 h-4 w-4" /> Invite to Workspace
                      </DropdownMenuItem>
                      {c.status === "Friend" ? (
                        <DropdownMenuItem onClick={async () => { if (!confirm('Remove this colleague?')) return; await removeColleague(c.email) }}>
                          <TrashIcon className="mr-2 h-4 w-4" /> Remove Friend
                        </DropdownMenuItem>
                      ) : c.direction === "Outgoing" ? (
                        <DropdownMenuItem onClick={async () => { if (!confirm('Cancel this request?')) return; await rejectColleagueRequest(c.email) }}>
                          <TrashIcon className="mr-2 h-4 w-4" /> Cancel Request
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            Showing {filtered.length} {filtered.length === 1 ? 'colleague' : 'colleagues'}
          </div>
        )}
      </div>

      {/* Share selection panel */}
      {shareForEmail && (
        <div className="rounded border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Share with {shareForEmail}</div>
            <Button size="sm" variant="ghost" onClick={() => { setShareForEmail(null); setShareFilesSel({}); setShareFoldersSel({}) }}>Close</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-2 text-xs text-muted-foreground">Files (My Vault)</div>
              <div className="grid gap-2">
                {vaultFilesForShare.map(f => (
                  <label key={f.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!shareFilesSel[f.id]} onChange={() => toggleSel(shareFilesSel, f.id, setShareFilesSel)} />
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate" title={f.name}>{f.name}</span>
                  </label>
                ))}
                {vaultFilesForShare.length === 0 && <div className="text-xs text-muted-foreground">No files in My Vault.</div>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-muted-foreground">Folders (My Vault)</div>
              <div className="grid gap-2">
                {vaultFoldersForShare.map((d: any) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!shareFoldersSel[d.id]} onChange={() => toggleSel(shareFoldersSel, d.id, setShareFoldersSel)} />
                    <FolderIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate" title={d.name}>{d.name}</span>
                  </label>
                ))}
                {vaultFoldersForShare.length === 0 && <div className="text-xs text-muted-foreground">No folders in My Vault.</div>}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShareForEmail(null); setShareFilesSel({}); setShareFoldersSel({}) }}>Cancel</Button>
            <Button onClick={confirmShare} disabled={(Object.values(shareFilesSel).filter(Boolean).length + Object.values(shareFoldersSel).filter(Boolean).length) === 0}>Share</Button>
          </div>
        </div>
      )}
    </div>
  )
}
