import { usePocketBase } from "@/services/filesys-store"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ModeToggle } from "@/components/mode-toggle"
import { SettingsIcon, TrashIcon } from "lucide-react"

export default function SettingsPage() {
  const { setFiles, setFolders, setTrash, setColleagues, setShares, setWorkspaceInvites } = usePocketBase()

  const resetAllData = () => {
    const ok = confirm("This will clear all local app data (files, folders, shares, colleagues). Continue?")
    if (!ok) return
    try {
      // Clear local storage keys used by the app
      localStorage.removeItem("filesys/files")
      localStorage.removeItem("filesys/folders")
      localStorage.removeItem("filesys/trash")
      localStorage.removeItem("filesys/colleagues")
      localStorage.removeItem("filesys/shares")
      localStorage.removeItem("filesys/workspaceInvites")
    } catch {}

    // Clear in-memory state
    setFiles([])
    setFolders([])
    setTrash([])
    setColleagues([])
    setShares([])
    setWorkspaceInvites([])
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" /> Settings
        </h2>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Appearance</h3>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="font-medium">Theme</div>
            <div className="text-sm text-muted-foreground">Toggle between light and dark mode.</div>
          </div>
          <ModeToggle />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Data</h3>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="font-medium">Reset App Data</div>
            <div className="text-sm text-muted-foreground">Clears local files, folders, shares, colleagues, and invites.</div>
          </div>
          <Button variant="destructive" onClick={resetAllData}>
            <TrashIcon className="w-4 h-4 mr-2" /> Clear Data
          </Button>
        </div>
      </div>
    </div>
  )
}
