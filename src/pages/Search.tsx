import { useMemo, useState } from "react"
import { SearchIcon, FileIcon, TrashIcon, StarIcon } from "lucide-react"
import { useFileSystem } from "@/services/filesys-store"
import type { ManagedFile, Folder } from "@/services/filesys-store"

export default function Search() {
  const { files, trash, folders } = useFileSystem()
  const [query, setQuery] = useState("")

  type ResultItem = { file: ManagedFile; source: "vault" | "trash" }

  const results: ResultItem[] = useMemo(() => {
    const base: ResultItem[] = [
      ...files.map((f) => ({ file: f, source: "vault" as const })),
      ...trash.map((f) => ({ file: f, source: "trash" as const })),
    ]
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(({ file }) => {
      const name = file.name.toLowerCase()
      const type = (file.type || "").toLowerCase()
      return name.includes(q) || type.includes(q)
    })
  }, [files, trash, query])

  const folderPath = (folderId: string | null) => {
    if (!folderId) return "Root"
    const path: string[] = []
    let current: Folder | undefined = folders.find((f) => f.id === folderId)
    while (current) {
      path.unshift(current.name)
      current = current.parentId ? folders.find((f) => f.id === current!.parentId) : undefined
    }
    return path.length ? path.join(" / ") : "Root"
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4 p-4 animate-in fade-in-0 duration-150">
      <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
        <SearchIcon className="h-5 w-5" />
        Search
      </h2>

      <div className="flex items-center rounded-md border border-input h-10 px-3">
        <SearchIcon className="h-4 w-4 text-muted-foreground mr-2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
        <span className="ml-2 text-sm text-muted-foreground">{results.length} results</span>
      </div>
      <p className="text-sm text-muted-foreground">Results include files from your vault and trash.</p>

      <div className="rounded-md border">
        {results.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No results found.</div>
        ) : (
          <ul className="divide-y">
            {results.map(({ file, source }) => (
              <li key={`${source}-${file.id}`} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileIcon className="h-4 w-4" />
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {folderPath(file.folderId)} • {(file.type || "file")} • {source === "trash" ? "Trash" : "Vault"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {file.favorite ? <StarIcon className="h-4 w-4" /> : null}
                  {source === "trash" ? <TrashIcon className="h-4 w-4" /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
