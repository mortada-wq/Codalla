import * as React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  useGetProject,
  useUpdateProject,
  useListCriteria,
  useCreateCriterion,
  useUpdateCriterion,
  useDeleteCriterion,
  getListCriteriaQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Check, GripVertical, Plus, Trash2, Target, BookOpen, Save, Pencil, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface BriefPanelProps {
  projectId: string
}

export function BriefPanel({ projectId }: BriefPanelProps) {
  const { data: project } = useGetProject(projectId)
  const updateProject = useUpdateProject()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [editingBrief, setEditingBrief] = useState(false)
  const [story, setStory] = useState("")
  const [target, setTarget] = useState("")

  useEffect(() => {
    if (project) {
      setStory((project as any).story || "")
      setTarget((project as any).target || "")
    }
  }, [project])

  const handleSaveBrief = () => {
    updateProject.mutate(
      { projectId, data: { story, target } as any },
      {
        onSuccess: () => {
          toast({ title: "Brief saved" })
          setEditingBrief(false)
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] })
        },
        onError: () => toast({ title: "Failed to save brief", variant: "destructive" }),
      }
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-5">
        {/* Project Brief */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Project Brief
            </h3>
            {!editingBrief ? (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingBrief(true)}>
                <Pencil className="w-3 h-3" />
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingBrief(false)}>
                  <X className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={handleSaveBrief} disabled={updateProject.isPending}>
                  <Save className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          {editingBrief ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-sans text-muted-foreground mb-1 block">Story / What are you building?</label>
                <Textarea
                  value={story}
                  onChange={e => setStory(e.target.value)}
                  placeholder="Describe the project story and motivation..."
                  className="min-h-[80px] resize-none text-xs bg-card/50 font-sans"
                />
              </div>
              <div>
                <label className="text-xs font-sans text-muted-foreground mb-1 block">Target / Goal</label>
                <Textarea
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="What does success look like?"
                  className="min-h-[60px] resize-none text-xs bg-card/50 font-sans"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {story ? (
                <div className="bg-card/40 border border-border/30 rounded-md p-3">
                  <p className="text-xs font-sans text-muted-foreground mb-1">Story</p>
                  <p className="text-xs text-foreground leading-relaxed">{story}</p>
                </div>
              ) : null}
              {target ? (
                <div className="bg-card/40 border border-border/30 rounded-md p-3">
                  <p className="text-xs font-sans text-muted-foreground mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Target
                  </p>
                  <p className="text-xs text-foreground leading-relaxed">{target}</p>
                </div>
              ) : null}
              {!story && !target && (
                <button
                  onClick={() => setEditingBrief(true)}
                  className="w-full text-center text-xs text-muted-foreground/60 font-sans py-4 border border-dashed border-border/30 rounded-md hover:border-primary/30 hover:text-muted-foreground transition-colors"
                >
                  + Add story and target
                </button>
              )}
            </div>
          )}
        </div>

        {/* Success Criteria */}
        <SuccessCriteriaPanel projectId={projectId} />
      </div>
    </ScrollArea>
  )
}

function SuccessCriteriaPanel({ projectId }: { projectId: string }) {
  const { data: criteria, isLoading } = useListCriteria(projectId)
  const createCriterion = useCreateCriterion()
  const updateCriterion = useUpdateCriterion()
  const deleteCriterion = useDeleteCriterion()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [newLabel, setNewLabel] = useState("")
  const [addingNew, setAddingNew] = useState(false)

  const doneCriteria = criteria?.filter(c => (c as any).done) ?? []
  const totalCriteria = criteria?.length ?? 0
  const doneCount = doneCriteria.length

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCriteriaQueryKey(projectId) })

  const handleAdd = () => {
    if (!newLabel.trim()) return
    createCriterion.mutate(
      { projectId, data: { label: newLabel.trim() } as any },
      {
        onSuccess: () => {
          setNewLabel("")
          setAddingNew(false)
          invalidate()
        },
        onError: () => toast({ title: "Failed to add criterion", variant: "destructive" }),
      }
    )
  }

  const handleToggle = (id: string, done: boolean) => {
    updateCriterion.mutate(
      { projectId, criterionId: id, data: { done: !done } as any },
      { onSuccess: invalidate }
    )
  }

  const handleDelete = (id: string) => {
    deleteCriterion.mutate(
      { projectId, criterionId: id },
      { onSuccess: invalidate }
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          Success Criteria
        </h3>
        {totalCriteria > 0 && (
          <Badge
            variant={doneCount === totalCriteria && totalCriteria > 0 ? "success" : "outline"}
            className="h-5"
          >
            {doneCount}/{totalCriteria} done
          </Badge>
        )}
      </div>

      {totalCriteria > 0 && (
        <div className="w-full bg-muted/30 rounded-full h-1">
          <div
            className="bg-green-500 h-1 rounded-full transition-all"
            style={{ width: `${totalCriteria > 0 ? (doneCount / totalCriteria) * 100 : 0}%` }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-4 text-center text-xs text-muted-foreground font-mono">Loading...</div>
      ) : (
        <div className="space-y-1">
          {criteria?.map(criterion => (
            <div
              key={criterion.id}
              className="group flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/20 transition-colors"
            >
              <button
                onClick={() => handleToggle(criterion.id, (criterion as any).done)}
                className={cn(
                  "flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center",
                  (criterion as any).done
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-border/60 hover:border-primary/50"
                )}
              >
                {(criterion as any).done && <Check className="w-2.5 h-2.5" />}
              </button>
              <span
                className={cn(
                  "flex-1 text-xs font-sans",
                  (criterion as any).done && "line-through text-muted-foreground"
                )}
              >
                {(criterion as any).label}
              </span>
              <button
                onClick={() => handleDelete(criterion.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addingNew ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Criterion label..."
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            className="h-7 text-xs bg-card/50 flex-1"
            onKeyDown={e => {
              if (e.key === "Enter") handleAdd()
              if (e.key === "Escape") setAddingNew(false)
            }}
          />
          <Button size="sm" className="h-7 px-2" onClick={handleAdd} disabled={createCriterion.isPending}>
            <Check className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAddingNew(false)}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="w-full text-left text-xs text-muted-foreground/60 font-sans py-1.5 px-2 rounded-md hover:bg-muted/20 hover:text-muted-foreground transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3 h-3" /> Add criterion
        </button>
      )}
    </div>
  )
}
