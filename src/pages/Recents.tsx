import { useMemo, useState } from "react"
import { useFileSystem } from "@/services/filesys-store"
import type { ManagedFile } from "@/services/filesys-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClockIcon, FileIcon, SearchIcon } from "lucide-react"

export default function Recents() {
  const { files, setFiles } = useFileSystem()
  const [query, setQuery] = useState("")

  const recents = useMemo(() => {
    const base = files.filter(f => !!f.openedAt)
    const sorted = base.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0))
    const q = query.trim().toLowerCase()
    return q ? sorted.filter(f => f.name.toLowerCase().includes(q)) : sorted
  }, [files, query])

  const openFile = (f: ManagedFile) => {
    // Update openedAt to now
    const now = Date.now()
    setFiles(prev => prev.map(x => x.id === f.id ? { ...x, openedAt: now } : x))
    // Try opening the file in a new tab (best-effort)
    if (f.url) {
      try {
        window.open(f.url, "_blank")
      } catch {}
    }
  }

  const clearRecents = () => {
    setFiles(prev => prev.map(x => x.openedAt ? { ...x, openedAt: null } : x))
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ClockIcon className="w-5 h-5" /> Recents
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recent files"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={clearRecents}>Clear Recents</Button>
        </div>
      </div>

      {recents.length === 0 ? (
        <div className="text-muted-foreground">No recently opened files.</div>
      ) : (
        <ul className="divide-y rounded-md border">
          {recents.map(f => (
            <li key={f.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <FileIcon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Last opened {new Date(f.openedAt || f.lastModified).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => openFile(f)}>Open</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
