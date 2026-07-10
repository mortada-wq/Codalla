import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useListMemoryNotes,
  useCreateMemoryNote,
  useUpdateMemoryNote,
  useDeleteMemoryNote,
  getListMemoryNotesQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Brain, Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownPreview } from "@/components/chat/markdown"

interface MemoryPanelProps {
  projectId: string
}

export function MemoryPanel({ projectId }: MemoryPanelProps) {
  const { data: notes, isLoading } = useListMemoryNotes(projectId)
  const createNote = useCreateMemoryNote()
  const updateNote = useUpdateMemoryNote()
  const deleteNote = useDeleteMemoryNote()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [creatingNew, setCreatingNew] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListMemoryNotesQueryKey(projectId) })

  const handleCreate = () => {
    if (!newTitle.trim()) return
    createNote.mutate(
      { projectId, data: { title: newTitle.trim(), content: newContent } },
      {
        onSuccess: () => {
          setCreatingNew(false)
          setNewTitle("")
          setNewContent("")
          invalidate()
        },
        onError: () => toast({ title: "Failed to create note", variant: "destructive" }),
      }
    )
  }

  const startEdit = (note: any) => {
    setEditingId(note.id)
    setEditTitle(note.title)
    setEditContent(note.content || "")
    setExpandedId(note.id)
  }

  const handleSave = (noteId: string) => {
    updateNote.mutate(
      { projectId, noteId, data: { title: editTitle, content: editContent } },
      {
        onSuccess: () => {
          setEditingId(null)
          invalidate()
          toast({ title: "Note saved" })
        },
        onError: () => toast({ title: "Failed to save note", variant: "destructive" }),
      }
    )
  }

  const handleDelete = (noteId: string) => {
    deleteNote.mutate(
      { projectId, noteId },
      {
        onSuccess: () => {
          if (editingId === noteId) setEditingId(null)
          if (expandedId === noteId) setExpandedId(null)
          invalidate()
        },
        onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
      }
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" />
            Memory Notes
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setCreatingNew(true)
              setExpandedId(null)
              setEditingId(null)
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {creatingNew && (
          <div className="border border-primary/30 rounded-md p-3 space-y-2 bg-card/40">
            <Input
              autoFocus
              placeholder="Note title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="h-7 text-xs bg-background/50"
            />
            <Textarea
              placeholder="Markdown content (optional)..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="min-h-[80px] resize-none text-xs bg-background/50 font-mono"
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setCreatingNew(false); setNewTitle(""); setNewContent("") }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleCreate}
                disabled={!newTitle.trim() || createNote.isPending}
              >
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-4 text-center text-xs text-muted-foreground font-sans">Loading...</div>
        ) : notes?.length === 0 && !creatingNew ? (
          <button
            onClick={() => setCreatingNew(true)}
            className="w-full text-center text-xs text-muted-foreground/60 font-sans py-6 border border-dashed border-border/30 rounded-md hover:border-primary/30 hover:text-muted-foreground transition-colors"
          >
            + Add a memory note
          </button>
        ) : (
          <div className="space-y-1">
            {notes?.map(note => (
              <div key={note.id} className="border border-border/30 rounded-md overflow-hidden">
                {/* Note header */}
                <div
                  className={cn(
                    "group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors",
                    expandedId === note.id && "bg-muted/10"
                  )}
                  onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                >
                  {expandedId === note.id ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 text-xs font-medium truncate">{note.title}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(note) }}
                      className="text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Note content */}
                {expandedId === note.id && (
                  <div className="border-t border-border/20">
                    {editingId === note.id ? (
                      <div className="p-3 space-y-2">
                        <Input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="h-7 text-xs bg-background/50"
                        />
                        <Textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="min-h-[100px] resize-none text-xs bg-background/50 font-mono"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-3 h-3 mr-1" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSave(note.id)}
                            disabled={updateNote.isPending}
                          >
                            <Save className="w-3 h-3 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3">
                        {note.content ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <MarkdownPreview content={note.content} />
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 font-sans italic">No content</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
