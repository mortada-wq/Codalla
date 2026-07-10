import { Layout } from "@/components/layout"
import { useGetProject, useGetFileTree, useGetFile, useSaveFile, useCreateDirectory, useDeleteFile, useRenameFile, useListConversations, useGetConversation, useListMessages, useSendChatMessage, useCreateConversation, useRunCodeAction, getGetFileTreeQueryKey, getListConversationsQueryKey, getListMessagesQueryKey, getGetFileQueryKey, useListCriteria, useListMemoryNotes } from "@workspace/api-client-react"
import { BriefPanel } from "@/components/project/brief-panel"
import { MemoryPanel } from "@/components/project/memory-panel"
import { useParams } from "wouter"
import { useState, useEffect, useRef, useMemo } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup, type ImperativePanelHandle } from "@/components/ui/resizable"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { File, Folder, FolderOpen, FileCode2, ChevronRight, Plus, X, MessageSquare, Code, Play, RefreshCw, Send, Check, GitBranch, Cpu, Brain, BookOpen, Download, PanelLeft, PanelRight, Circle, Search } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu"
import Editor, { useMonaco } from "@monaco-editor/react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ChatMessage } from "@/components/chat/message"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AnalyzeMediaButton } from "@/components/analyze-media-button"

// Types
type FileDialog =
  | { kind: 'new-file'; parentPath: string }
  | { kind: 'new-folder'; parentPath: string }
  | { kind: 'rename'; oldPath: string; name: string }
  | { kind: 'delete'; path: string; name: string; isDir: boolean }

type OpenFile = {
  path: string;
  name: string;
  isDirty?: boolean;
}

export default function EditorPage() {
  const { projectId } = useParams()
  const { data: project, isLoading: isLoadingProject } = useGetProject(projectId || "")
  const { data: fileTree, isLoading: isLoadingTree } = useGetFileTree(projectId || "")
  const { data: conversations } = useListConversations({ projectId })
  
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState<Record<string, string>>({})
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)

  // Collapsible panel refs and state
  const explorerRef = useRef<ImperativePanelHandle>(null)
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const rightPanelRef = useRef<ImperativePanelHandle>(null)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  // Track active conversation for model/provider
  const activeConversation = conversations?.find(c => c.id === activeConversationId)
  
  // File operations
  const saveFile = useSaveFile()
  const [fileDialog, setFileDialog] = useState<FileDialog | null>(null)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const handleNewFile = (parentPath: string) => setFileDialog({ kind: 'new-file', parentPath })
  const handleNewFolder = (parentPath: string) => setFileDialog({ kind: 'new-folder', parentPath })
  const handleRename = (path: string, name: string) => setFileDialog({ kind: 'rename', oldPath: path, name })
  const handleDeleteFile = (path: string, name: string, isDir: boolean) => setFileDialog({ kind: 'delete', path, name, isDir })

  // Auto-select latest conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id)
    }
  }, [conversations, activeConversationId])
  
  const handleFileOpen = (path: string, name: string) => {
    if (!openFiles.find(f => f.path === path)) {
      setOpenFiles([...openFiles, { path, name }])
    }
    setActiveFile(path)
  }

  const handleFileClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    const newFiles = openFiles.filter(f => f.path !== path)
    setOpenFiles(newFiles)
    
    if (activeFile === path) {
      setActiveFile(newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null)
    }
    
    // Clean up content memory
    const newContent = { ...editorContent }
    delete newContent[path]
    setEditorContent(newContent)
  }

  const handleSave = () => {
    if (!activeFile || !editorContent[activeFile]) return
    
    saveFile.mutate({
      projectId: projectId!,
      data: {
        path: activeFile,
        content: editorContent[activeFile]
      }
    }, {
      onSuccess: () => {
        setOpenFiles(files => files.map(f => f.path === activeFile ? { ...f, isDirty: false } : f))
        toast({ title: "Saved", description: `${activeFile} saved.` })
      }
    })
  }

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFile, editorContent, projectId])

  // Cmd+P: quick open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setQuickOpenOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (isLoadingProject) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">Loading project...</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Top Header */}
        <div className="h-9 shrink-0 border-b border-border/50 flex items-center justify-between px-2 bg-sidebar/40">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-xs"
              title={explorerCollapsed ? "Show explorer" : "Hide explorer"}
              onClick={() => explorerCollapsed ? explorerRef.current?.expand() : explorerRef.current?.collapse()}
              className={explorerCollapsed ? "text-muted-foreground/40" : "text-muted-foreground hover:text-foreground"}
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-border/50" />
            <span className="font-mono font-medium text-xs text-foreground/80">{project?.name}</span>
            {project?.currentBranch && (
              <Badge variant="outline" className="font-mono">
                <GitBranch className="w-2.5 h-2.5 mr-1" />
                {project.currentBranch}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" className="font-mono text-muted-foreground/60 hover:text-foreground">
              <RefreshCw className="w-2.5 h-2.5 mr-1.5" />
              Push
            </Button>
            <div className="h-4 w-px bg-border/50" />
            <Button
              variant="ghost"
              size="icon-xs"
              title={rightPanelCollapsed ? "Show AI panel" : "Hide AI panel"}
              onClick={() => rightPanelCollapsed ? rightPanelRef.current?.expand() : rightPanelRef.current?.collapse()}
              className={rightPanelCollapsed ? "text-muted-foreground/40" : "text-muted-foreground hover:text-foreground"}
            >
              <PanelRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Main Workspace */}
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* File Tree Panel */}
          <ResizablePanel
            ref={explorerRef}
            defaultSize={20}
            minSize={14}
            maxSize={32}
            collapsible
            collapsedSize={0}
            onCollapse={() => setExplorerCollapsed(true)}
            onExpand={() => setExplorerCollapsed(false)}
            className="bg-sidebar"
          >
            <div className="flex flex-col h-full">
              <div className="panel-header">
                <span>Explorer</span>
                <div className="ml-auto flex gap-1">
                  <AnalyzeMediaButton projectId={projectId!} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-muted"
                    title="Quick open (⌘P)"
                    onClick={() => setQuickOpenOpen(true)}
                  >
                    <Search className="h-3 w-3" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleNewFile('')}>New File</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleNewFolder('')}>New Folder</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {isLoadingTree ? (
                    <div className="space-y-0.5">
                      {[80, 65, 92, 55, 72, 88, 60, 75].map((w, i) => (
                        <div key={i} className="flex items-center gap-2 py-1 px-2">
                          <Skeleton className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                          <Skeleton className="h-3.5 rounded-sm" style={{ width: `${w}%` }} />
                        </div>
                      ))}
                    </div>
                  ) : !fileTree?.nodes?.length ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Code className="w-8 h-8 mb-2 text-muted-foreground/20" />
                      <p className="text-xs font-mono text-muted-foreground/50">No files yet</p>
                      <button
                        className="mt-2 text-xs font-mono text-primary/70 hover:text-primary transition-colors"
                        onClick={() => handleNewFile('')}
                      >+ New file</button>
                    </div>
                  ) : (
                    fileTree.nodes.map((node: any, i: number) => (
                      <FileTreeNode 
                        key={i} 
                        node={node} 
                        projectId={projectId!} 
                        onFileOpen={handleFileOpen}
                        onNewFile={handleNewFile}
                        onNewFolder={handleNewFolder}
                        onRename={handleRename}
                        onDelete={handleDeleteFile}
                        depth={0} 
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
          
          <ResizableHandle className="bg-border/50 hover:bg-primary/50 transition-colors w-1" />
          
          {/* Editor Panel */}
          <ResizablePanel defaultSize={55} className="bg-background flex flex-col min-w-0">
            {openFiles.length > 0 ? (
              <>
                {/* File tabs */}
                <div className="flex h-9 border-b border-border/50 bg-sidebar/20 overflow-x-auto no-scrollbar">
                  {openFiles.map(file => {
                    const isActive = activeFile === file.path
                    return (
                      <div
                        key={file.path}
                        onClick={() => setActiveFile(file.path)}
                        className={cn(
                          "group relative flex items-center h-full px-3 border-r border-border/40 cursor-pointer min-w-0 shrink-0 max-w-[160px] transition-colors duration-100",
                          isActive
                            ? "bg-background text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1.5px] after:bg-primary"
                            : "bg-transparent text-muted-foreground/60 hover:text-muted-foreground hover:bg-sidebar/60"
                        )}
                      >
                        {file.isDirty && (
                          <Circle className="h-1.5 w-1.5 fill-warning text-warning shrink-0 mr-1.5" />
                        )}
                        <span className="truncate font-mono text-xs">{file.name}</span>
                        <button
                          className={cn(
                            "ml-2 shrink-0 rounded-sm p-0.5 transition-all",
                            "opacity-0 group-hover:opacity-100",
                            isActive && "opacity-60",
                            "hover:opacity-100 hover:bg-muted/60"
                          )}
                          onClick={(e) => handleFileClose(e, file.path)}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex-1 relative">
                  {activeFile && (
                    <EditorView 
                      projectId={projectId!} 
                      filePath={activeFile} 
                      content={editorContent[activeFile]}
                      onChange={(val) => {
                        setEditorContent(prev => ({ ...prev, [activeFile]: val || '' }))
                        setOpenFiles(files => files.map(f => f.path === activeFile ? { ...f, isDirty: true } : f))
                      }}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-sidebar/10">
                <Code className="h-16 w-16 mb-4 opacity-20" />
                <p className="font-mono text-sm mb-2">Select a file from the explorer to begin.</p>
                <div className="flex gap-4 text-xs font-mono opacity-60">
                  <span>Cmd/Ctrl + S to save</span>
                  <span>Cmd/Ctrl + P to search</span>
                </div>
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle className="bg-border/50 hover:bg-primary/50 transition-colors w-1" />

          {/* AI Chat Panel */}
          <ResizablePanel
            ref={rightPanelRef}
            defaultSize={25}
            minSize={18}
            maxSize={42}
            collapsible
            collapsedSize={0}
            onCollapse={() => setRightPanelCollapsed(true)}
            onExpand={() => setRightPanelCollapsed(false)}
            className="bg-sidebar/20 flex flex-col"
          >
            <Tabs defaultValue="chat" className="flex flex-col h-full">
              <div className="h-9 shrink-0 border-b border-border/50 px-2 flex items-center justify-between bg-sidebar/40">
                <TabsList className="h-full bg-transparent gap-0">
                  <TabsTrigger value="chat" className="h-full rounded-none px-2.5">
                    <MessageSquare className="w-3 h-3 mr-1.5" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="h-full rounded-none px-2.5">
                    <Play className="w-3 h-3 mr-1.5" />
                    Actions
                  </TabsTrigger>
                  <TabsTrigger value="project" className="h-full rounded-none px-2.5">
                    <BookOpen className="w-3 h-3 mr-1.5" />
                    Project
                  </TabsTrigger>
                </TabsList>
                
                {/* Conversation Selector/New */}
                <div className="flex items-center gap-1">
                  <Select value={activeConversationId || undefined} onValueChange={setActiveConversationId}>
                    <SelectTrigger className="h-6 w-[120px] text-xs font-mono border-none bg-transparent shadow-none px-2 focus:ring-0">
                      <SelectValue placeholder="New Chat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" className="text-xs font-mono text-primary font-bold"><Plus className="w-3 h-3 inline mr-1" />New Chat</SelectItem>
                      {conversations?.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs font-mono">{c.title || 'Untitled'}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TabsContent value="chat" className="flex-1 flex flex-col m-0 overflow-hidden outline-none">
                {activeConversationId === "new" || !activeConversationId ? (
                  <NewConversationView projectId={projectId!} onCreated={id => setActiveConversationId(id)} />
                ) : (
                  <ChatView
                    conversationId={activeConversationId}
                    projectId={projectId!}
                    modelId={activeConversation?.modelId ?? "deepseek-ai/DeepSeek-V3"}
                    provider={activeConversation?.provider ?? "siliconflow"}
                    activeFileContent={activeFile ? editorContent[activeFile] : undefined}
                    onApplyFile={(path, content) => {
                      handleFileOpen(path, path.split('/').pop() || path)
                      setEditorContent(prev => ({ ...prev, [path]: content }))
                      setOpenFiles(files => {
                        const exists = files.find(f => f.path === path)
                        if (exists) return files.map(f => f.path === path ? { ...f, isDirty: true } : f)
                        return [...files, { path, name: path.split('/').pop() || path, isDirty: true }]
                      })
                      toast({ title: "File applied", description: `${path} — press Ctrl+S to save.` })
                    }}
                  />
                )}
              </TabsContent>

              <TabsContent value="actions" className="flex-1 m-0 p-4 outline-none overflow-y-auto">
                <CodeActionsView
                  projectId={projectId!}
                  activeFile={activeFile}
                  editorContent={editorContent[activeFile!]}
                  onApply={(code) => {
                    if (!activeFile) return
                    setEditorContent(prev => ({ ...prev, [activeFile]: code }))
                    setOpenFiles(files => files.map(f => f.path === activeFile ? { ...f, isDirty: true } : f))
                    toast({ title: "Changes applied", description: "Review edits then press Ctrl+S to save." })
                  }}
                />
              </TabsContent>

              <TabsContent value="project" className="flex-1 m-0 overflow-hidden outline-none">
                <Tabs defaultValue="brief" className="flex flex-col h-full">
                  <div className="px-3 pt-2 border-b border-border/30">
                    <TabsList className="h-7 bg-transparent p-0 space-x-1">
                      <TabsTrigger value="brief" className="px-2">
                        <BookOpen className="w-3 h-3 mr-1" /> Brief
                      </TabsTrigger>
                      <TabsTrigger value="memory" className="px-2">
                        <Brain className="w-3 h-3 mr-1" /> Memory
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="brief" className="flex-1 m-0 overflow-hidden outline-none">
                    <BriefPanel projectId={projectId!} />
                  </TabsContent>
                  <TabsContent value="memory" className="flex-1 m-0 overflow-hidden outline-none">
                    <MemoryPanel projectId={projectId!} />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>

        {/* Status Bar */}
        <div className="h-5 shrink-0 border-t border-border/40 bg-sidebar/80 flex items-center px-3 gap-3 text-xs font-mono select-none">
          {project?.currentBranch && (
            <span className="flex items-center gap-1 text-info/70 hover:text-info transition-colors cursor-default">
              <GitBranch className="w-2.5 h-2.5" />
              {project.currentBranch}
            </span>
          )}
          {activeFile && (
            <>
              <span className="text-border">·</span>
              <span className="text-muted-foreground/50 truncate max-w-[260px]">{activeFile}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-3 text-muted-foreground/40">
            {activeFile && (
              <span className="uppercase tracking-wider text-xs">
                {activeFile.split('.').pop()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Cpu className="w-2 h-2" />
              Codalla
            </span>
          </div>
        </div>
      </div>
      {fileDialog && (
        <FileOpDialog
          dialog={fileDialog}
          projectId={projectId!}
          onClose={() => setFileDialog(null)}
          onSuccess={() => {
            setFileDialog(null)
            queryClient.invalidateQueries({ queryKey: getGetFileTreeQueryKey(projectId!) })
          }}
        />
      )}
      <QuickOpenDialog
        open={quickOpenOpen}
        onOpenChange={setQuickOpenOpen}
        fileTree={fileTree}
        onFileOpen={handleFileOpen}
      />
    </Layout>
  )
}

function EditorView({ projectId, filePath, content, onChange }: { projectId: string, filePath: string, content?: string, onChange: (val: string | undefined) => void }) {
  const { data: fileData, isLoading } = useGetFile({ projectId, filePath })
  const monaco = useMonaco()

  // Language detection
  const language = useMemo(() => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const map: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript',
      'js': 'javascript', 'jsx': 'javascript',
      'py': 'python', 'json': 'json',
      'html': 'html', 'css': 'css',
      'md': 'markdown', 'go': 'python'
    }
    return map[ext || ''] || 'plaintext'
  }, [filePath])

  // Initial content load
  useEffect(() => {
    if (fileData && content === undefined) {
      onChange(fileData.content)
    }
  }, [fileData, content, onChange])

  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('codalla-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment',           foreground: '3d4554', fontStyle: 'italic' },
          { token: 'string',            foreground: '1fc96e' },   // success green
          { token: 'string.escape',     foreground: '09d9f5' },   // cyan
          { token: 'number',            foreground: 'f5a623' },   // warning amber
          { token: 'keyword',           foreground: '09d9f5' },   // primary cyan
          { token: 'keyword.control',   foreground: 'a87ef5' },   // purple
          { token: 'type',              foreground: '4d9eff' },   // info blue
          { token: 'type.identifier',   foreground: '4d9eff' },
          { token: 'class',             foreground: '4d9eff' },
          { token: 'function',          foreground: 'e4e8f0' },
          { token: 'variable',          foreground: 'e4e8f0' },
          { token: 'constant',          foreground: 'f5a623' },
          { token: 'delimiter',         foreground: '52596a' },
          { token: 'tag',               foreground: '09d9f5' },
          { token: 'attribute.name',    foreground: '4d9eff' },
          { token: 'attribute.value',   foreground: '1fc96e' },
        ],
        colors: {
          'editor.background':                  '#0d0f14',
          'editor.foreground':                  '#e4e8f0',
          'editor.lineHighlightBackground':     '#13161f',
          'editor.selectionBackground':         '#09d9f525',
          'editor.inactiveSelectionBackground': '#09d9f510',
          'editorLineNumber.foreground':        '#2d3345',
          'editorLineNumber.activeForeground':  '#4b5680',
          'editorIndentGuide.background1':      '#1a1d25',
          'editorIndentGuide.activeBackground1':'#09d9f530',
          'editorCursor.foreground':            '#09d9f5',
          'editorBracketMatch.background':      '#09d9f520',
          'editorBracketMatch.border':          '#09d9f550',
          'editorWidget.background':            '#111318',
          'editorWidget.border':                '#1a1d25',
          'editorSuggestWidget.background':     '#111318',
          'editorSuggestWidget.border':         '#1a1d25',
          'editorSuggestWidget.selectedBackground': '#09d9f515',
          'scrollbarSlider.background':         '#2d333b35',
          'scrollbarSlider.hoverBackground':    '#2d333b60',
          'scrollbar.shadow':                   '#00000000',
          'editorGutter.background':            '#0d0f14',
        }
      });
      monaco.editor.setTheme('codalla-dark');
    }
  }, [monaco])

  if (isLoading && content === undefined) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
  }

  return (
    <Editor
      height="100%"
      language={language}
      theme="codalla-dark"
      value={content !== undefined ? content : fileData?.content || ''}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        wordWrap: "on",
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: "smooth",
        padding: { top: 16 },
        tabSize: 2,
      }}
    />
  )
}

function FileTreeNode({ node, projectId, onFileOpen, onNewFile, onNewFolder, onRename, onDelete, depth }: {
  node: any
  projectId: string
  onFileOpen: (path: string, name: string) => void
  onNewFile: (parentPath: string) => void
  onNewFolder: (parentPath: string) => void
  onRename: (path: string, name: string) => void
  onDelete: (path: string, name: string, isDir: boolean) => void
  depth: number
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isDir = node.type === 'directory'
  const paddingLeft = `${depth * 12 + 8}px`

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div 
            className="flex items-center py-1 px-2 hover:bg-accent/50 cursor-pointer rounded-sm text-sm group"
            style={{ paddingLeft }}
            onClick={() => isDir ? setIsOpen(!isOpen) : onFileOpen(node.path, node.name)}
          >
            {isDir ? (
              <>
                <ChevronRight className={cn('w-3 h-3 mr-0.5 text-muted-foreground/50 transition-transform shrink-0', isOpen && 'rotate-90')} />
                {isOpen
                  ? <FolderOpen className="w-3.5 h-3.5 mr-1.5 text-primary/60 shrink-0" />
                  : <Folder className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/40 shrink-0" />
                }
              </>
            ) : (
              <FileIcon path={node.name} className="mr-1.5" />
            )}
            <span className="truncate font-mono text-xs">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {isDir ? (
            <>
              <ContextMenuItem onClick={() => onNewFile(node.path)}><Plus className="w-4 h-4 mr-2" /> New File</ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(node.path)}><Folder className="w-4 h-4 mr-2" /> New Folder</ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem onClick={() => onFileOpen(node.path, node.name)}>Open</ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onRename(node.path, node.name)}>Rename</ContextMenuItem>
          <ContextMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => onDelete(node.path, node.name, isDir)}>Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {isDir && isOpen && node.children && (
        <div>
          {node.children.map((child: any, i: number) => (
            <FileTreeNode key={i} node={child} projectId={projectId} onFileOpen={onFileOpen} onNewFile={onNewFile} onNewFolder={onNewFolder} onRename={onRename} onDelete={onDelete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function flattenTree(nodes: any[]): Array<{ name: string; path: string }> {
  const files: Array<{ name: string; path: string }> = []
  for (const node of nodes ?? []) {
    if (node.type === 'file') files.push({ name: node.name, path: node.path })
    if (node.type === 'directory' && node.children) files.push(...flattenTree(node.children))
  }
  return files
}

const EXT_COLORS: Record<string, string> = {
  ts: 'text-blue-400', tsx: 'text-cyan-400',
  js: 'text-yellow-400', jsx: 'text-yellow-300', mjs: 'text-yellow-400', cjs: 'text-yellow-400',
  css: 'text-purple-400', scss: 'text-pink-400', less: 'text-pink-300',
  json: 'text-orange-400', jsonc: 'text-orange-400',
  html: 'text-orange-500', htm: 'text-orange-500',
  md: 'text-slate-400', mdx: 'text-slate-300',
  py: 'text-green-400',
  go: 'text-cyan-500',
  rs: 'text-orange-600',
  sh: 'text-green-500', bash: 'text-green-500',
  yaml: 'text-red-400', yml: 'text-red-400',
  toml: 'text-amber-500',
  env: 'text-emerald-400',
  sql: 'text-blue-300',
  graphql: 'text-pink-500', gql: 'text-pink-500',
  vue: 'text-green-400', svelte: 'text-orange-500',
  rb: 'text-red-500', php: 'text-violet-400',
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = (path.split('.').pop() ?? '').toLowerCase()
  return <FileCode2 className={cn('w-3.5 h-3.5 shrink-0', EXT_COLORS[ext] ?? 'text-muted-foreground/60', className)} />
}

function QuickOpenDialog({
  open,
  onOpenChange,
  fileTree,
  onFileOpen,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  fileTree: any
  onFileOpen: (path: string, name: string) => void
}) {
  const allFiles = useMemo(() => flattenTree(fileTree?.nodes ?? []), [fileTree])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search files…" className="font-mono text-sm" />
      <CommandList>
        <CommandEmpty className="py-6 text-center text-sm font-mono text-muted-foreground">No files found.</CommandEmpty>
        <CommandGroup heading="Files">
          {allFiles.map(f => {
            const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : ''
            return (
              <CommandItem
                key={f.path}
                value={f.path}
                onSelect={() => { onFileOpen(f.path, f.name); onOpenChange(false) }}
                className="flex items-center gap-2 font-mono cursor-pointer"
              >
                <FileIcon path={f.name} />
                <span className="flex-1 truncate text-sm">{f.name}</span>
                {dir && <span className="text-muted-foreground/40 text-xs truncate max-w-[180px]">{dir}</span>}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

function FileOpDialog({
  dialog,
  projectId,
  onClose,
  onSuccess,
}: {
  dialog: FileDialog
  projectId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(() => dialog.kind === 'rename' ? dialog.name : '')
  const saveFile = useSaveFile()
  const createDir = useCreateDirectory()
  const deleteFileMut = useDeleteFile()
  const renameFileMut = useRenameFile()
  const { toast } = useToast()

  const isPending = saveFile.isPending || createDir.isPending || deleteFileMut.isPending || renameFileMut.isPending

  const handleSubmit = () => {
    if (dialog.kind === 'new-file') {
      const filePath = dialog.parentPath ? `${dialog.parentPath}/${name.trim()}` : name.trim()
      saveFile.mutate({ projectId, data: { path: filePath, content: '' } }, {
        onSuccess: () => { toast({ title: 'File created', description: filePath }); onSuccess() },
        onError: (e: any) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
      })
    } else if (dialog.kind === 'new-folder') {
      const folderPath = dialog.parentPath ? `${dialog.parentPath}/${name.trim()}` : name.trim()
      createDir.mutate({ projectId, data: { path: folderPath } }, {
        onSuccess: () => { toast({ title: 'Folder created', description: folderPath }); onSuccess() },
        onError: (e: any) => toast({ title: 'Create failed', description: e.message, variant: 'destructive' }),
      })
    } else if (dialog.kind === 'rename') {
      const dir = dialog.oldPath.includes('/') ? dialog.oldPath.substring(0, dialog.oldPath.lastIndexOf('/')) : ''
      const newPath = dir ? `${dir}/${name.trim()}` : name.trim()
      renameFileMut.mutate({ projectId, data: { oldPath: dialog.oldPath, newPath } }, {
        onSuccess: () => { toast({ title: 'Renamed' }); onSuccess() },
        onError: (e: any) => toast({ title: 'Rename failed', description: e.message, variant: 'destructive' }),
      })
    } else if (dialog.kind === 'delete') {
      deleteFileMut.mutate({ params: { projectId, filePath: dialog.path } }, {
        onSuccess: () => { toast({ title: 'Deleted', description: dialog.name }); onSuccess() },
        onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
      })
    }
  }

  if (dialog.kind === 'delete') {
    return (
      <AlertDialog open onOpenChange={open => !open && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {dialog.isDir ? 'folder' : 'file'}?</AlertDialogTitle>
            <AlertDialogDescription>
              <code className="font-mono text-sm">{dialog.name}</code> will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  const title = dialog.kind === 'new-file' ? 'New File' : dialog.kind === 'new-folder' ? 'New Folder' : 'Rename'
  const placeholder = dialog.kind === 'new-file' ? 'filename.ts' : dialog.kind === 'new-folder' ? 'folder-name' : dialog.name

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {(dialog.kind === 'new-file' || dialog.kind === 'new-folder') && dialog.parentPath && (
            <DialogDescription className="font-mono text-xs truncate">in /{dialog.parentPath}</DialogDescription>
          )}
        </DialogHeader>
        <Input
          autoFocus
          placeholder={placeholder}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleSubmit() }}
          className="font-mono"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending}>
            {isPending ? '…' : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NewConversationView({ projectId, onCreated }: { projectId: string, onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("")
  const createChat = useCreateConversation()
  const queryClient = useQueryClient()

  const handleCreate = () => {
    createChat.mutate({
      data: {
        projectId,
        title: title || "New Conversation",
        modelId: "default", // Should fetch from settings
        provider: "openrouter" // Should fetch from settings
      }
    }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ projectId }) })
        onCreated(res.id)
      }
    })
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
      <h3 className="font-semibold text-sm mb-2">Start a new chat</h3>
      <p className="text-sm text-muted-foreground mb-6 font-mono">Ask questions, explain code, or generate tests.</p>
      
      <div className="w-full max-w-sm space-y-4">
        <Input 
          placeholder="Conversation title (optional)..." 
          value={title} 
          onChange={e => setTitle(e.target.value)}
          className="bg-card/50"
        />
        <Button className="w-full" onClick={handleCreate} disabled={createChat.isPending}>
          {createChat.isPending ? "Starting..." : "Start Chatting"}
        </Button>
      </div>
    </div>
  )
}

function ChatView({
  conversationId,
  projectId,
  modelId,
  provider,
  activeFileContent,
  onApplyFile,
}: {
  conversationId: string
  projectId: string
  modelId: string
  provider: string
  activeFileContent?: string
  onApplyFile?: (path: string, content: string) => void
}) {
  const { data: messages, isLoading } = useListMessages(conversationId)
  const { data: project } = useGetProject(projectId)
  const { data: criteria } = useListCriteria(projectId)
  const { data: memoryNotes } = useListMemoryNotes(projectId)
  const [input, setInput] = useState("")
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Keep a ref to the AbortController so we can cancel on unmount or conversation change
  const abortRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Cancel in-flight stream when component unmounts or conversationId changes
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [conversationId])

  // Auto-scroll to bottom whenever messages or streaming content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent, isStreaming])

  const buildMemoryContext = (): string | undefined => {
    if (!memoryEnabled) return undefined
    const parts: string[] = []
    if ((project as any)?.story) parts.push(`## Project Story\n${(project as any).story}`)
    if ((project as any)?.target) parts.push(`## Project Target\n${(project as any).target}`)
    if (criteria && criteria.length > 0) {
      const list = criteria.map((c: any) => `- [${c.done ? 'x' : ' '}] ${c.label}`).join('\n')
      parts.push(`## Success Criteria\n${list}`)
    }
    if (memoryNotes && memoryNotes.length > 0) {
      const notes = memoryNotes.map((n: any) => `### ${n.title}\n${n.content || ''}`).join('\n\n')
      parts.push(`## Project Memory\n${notes}`)
    }
    return parts.length > 0 ? parts.join('\n\n') : undefined
  }

  const handleSend = async () => {
    if (!input.trim() || !conversationId || isStreaming) return

    const content = input
    setInput("")
    setStreamingContent("")
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const memoryContext = buildMemoryContext()
    const combinedContext = [memoryContext, activeFileContent].filter(Boolean).join('\n\n---\n\n') || undefined

    try {
      const response = await fetch("/api/ai/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          content,
          modelId,
          provider,
          context: combinedContext,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let streamError = false

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const payload = line.slice(6).trim()
          if (!payload || payload === "[DONE]") continue
          try {
            const data = JSON.parse(payload)
            if (data.content) setStreamingContent(prev => (prev ?? "") + data.content)
            if (data.error) {
              toast({ title: "AI Error", description: data.error, variant: "destructive" })
              streamError = true
              break outer // terminate outer reader loop on error
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (err: any) {
      // Ignore abort errors (user navigated away / conversation changed)
      if (err.name !== "AbortError") {
        toast({ title: "Stream error", description: err.message, variant: "destructive" })
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
      setStreamingContent(null)
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) })
    }
  }

  return (
    <div className="flex flex-col h-full bg-background relative">
      <ScrollArea className="flex-1">
        <div className="pb-4" ref={scrollRef}>
          {isLoading ? (
            <div className="p-4 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>
          ) : messages?.length === 0 && !isStreaming ? (
            <div className="p-8 text-center text-muted-foreground text-sm font-mono">
              No messages yet. Send a message to start.
            </div>
          ) : (
            messages?.map((msg, i) => (
              <ChatMessageWithFileApply
                key={msg.id}
                message={msg}
                isLast={i === messages.length - 1}
                onApplyFile={onApplyFile}
              />
            ))
          )}

          {/* Live streaming bubble */}
          {isStreaming && (
            <div className="py-4 bg-card/30 border-y border-border/50">
              <div className="flex gap-4 max-w-4xl mx-auto px-4">
                <div className="w-8 h-8 rounded-md bg-secondary text-secondary-foreground flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  AI
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs font-medium text-foreground">Assistant</p>
                  {streamingContent ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingContent) }}
                    />
                  ) : (
                    <div className="flex gap-1 items-center h-5">
                      <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 bg-sidebar/80 border-t border-border/50 backdrop-blur-sm z-10">
        <div className="relative flex items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question about your code..."
            className="min-h-[80px] max-h-[300px] resize-none pr-12 bg-background border-border focus-visible:ring-primary/50"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex justify-between items-center mt-2 px-1">
          <button
            onClick={() => setMemoryEnabled(v => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs font-mono transition-colors rounded px-1.5 py-0.5",
              memoryEnabled
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Include project story, target, criteria, and memory notes as context"
          >
            <Brain className="w-3 h-3" />
            {memoryEnabled ? "Memory on" : "Memory off"}
          </button>
          <span className="text-xs text-muted-foreground font-mono opacity-60">{provider}/{modelId.split("/").pop()}</span>
        </div>
      </div>
    </div>
  )
}

/** Parse AI assistant messages for file-change blocks and render Apply buttons */
function parseFileBlocks(content: string): Array<{ type: 'text'; value: string } | { type: 'file'; path: string; lang: string; code: string }> {
  const blocks: Array<{ type: 'text'; value: string } | { type: 'file'; path: string; lang: string; code: string }> = []
  // Match patterns like:
  //   ### File: `path/to/file`   or   ### File: path/to/file
  //   followed by a fenced code block
  const fileBlockRegex = /###\s+File:\s+`?([^\n`]+)`?\s*\n```(\w*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = fileBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    blocks.push({ type: 'file', path: match[1].trim(), lang: match[2] || 'text', code: match[3] })
    lastIndex = fileBlockRegex.lastIndex
  }
  if (lastIndex < content.length) {
    blocks.push({ type: 'text', value: content.slice(lastIndex) })
  }
  return blocks
}

function ChatMessageWithFileApply({
  message,
  isLast,
  onApplyFile,
}: {
  message: any
  isLast?: boolean
  onApplyFile?: (path: string, content: string) => void
}) {
  const isUser = message.role === "user"
  const isSystem = message.role === "system"
  if (isSystem) return null

  const blocks = !isUser && onApplyFile ? parseFileBlocks(message.content) : null
  const hasFileBlocks = blocks?.some(b => b.type === 'file')

  return (
    <div className={cn("py-4", isUser ? "bg-transparent" : "bg-card/30 border-y border-border/50")}>
      <div className="flex gap-4 max-w-4xl mx-auto px-4">
        <div className="flex-shrink-0">
          <div className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center font-mono text-xs font-bold",
            isUser ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
          )}>
            {isUser ? "U" : "AI"}
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-hidden min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              {isUser ? "You" : "Assistant"}
            </p>
            {!isUser && message.cost && (
              <span className="text-xs font-mono text-muted-foreground opacity-50">
                ${message.cost?.toFixed(5)} ({message.tokensUsed} tokens)
              </span>
            )}
          </div>
          {hasFileBlocks && blocks ? (
            <div className="space-y-3">
              {blocks.map((block, i) => {
                if (block.type === 'text') {
                  return block.value.trim() ? (
                    <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-black/50 prose-pre:border prose-pre:border-border/50">
                      <div dangerouslySetInnerHTML={{ __html: formatMarkdown(block.value) }} />
                    </div>
                  ) : null
                }
                return (
                  <div key={i} className="border border-primary/20 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-primary/5 border-b border-primary/10">
                      <span className="text-xs font-mono text-primary/80 truncate">{block.path}</span>
                      <Button
                        variant="success"
                        size="xs"
                        className="shrink-0 ml-2"
                        onClick={() => onApplyFile?.(block.path, block.code)}
                      >
                        <Download className="w-2.5 h-2.5 mr-1" /> Apply
                      </Button>
                    </div>
                    <pre className="bg-card p-3 overflow-x-auto text-xs font-mono text-foreground/70 max-h-48">
                      <code>{block.code}</code>
                    </pre>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-black/50 prose-pre:border prose-pre:border-border/50">
              <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CodeActionsView({
  projectId,
  activeFile,
  editorContent,
  onApply,
}: {
  projectId: string
  activeFile: string | null
  editorContent?: string
  onApply?: (code: string) => void
}) {
  const runAction = useRunCodeAction()
  const { toast } = useToast()
  const [result, setResult] = useState<any>(null)

  const handleAction = (actionType: 'explain' | 'fix' | 'optimize' | 'tests' | 'document') => {
    if (!activeFile || !editorContent) {
      toast({ title: "No active file", description: "Open a file first.", variant: "destructive" })
      return
    }
    setResult(null)
    runAction.mutate({
      data: {
        action: actionType,
        code: editorContent,
        filename: activeFile,
        modelId: "deepseek-ai/DeepSeek-V3",
        provider: "siliconflow"
      }
    }, {
      onSuccess: (data) => setResult(data),
      onError: (err: any) => {
        toast({ title: "Action failed", description: err.message || "Unknown error", variant: "destructive" })
      }
    })
  }

  const hasDiff = result?.suggestedCode &&
    ['fix', 'optimize', 'document'].includes(result.action)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="outline" size="sm" className="justify-start font-mono" onClick={() => handleAction('explain')} disabled={runAction.isPending || !activeFile}>
          <MessageSquare className="w-3 h-3 mr-2 text-info" /> Explain
        </Button>
        <Button variant="outline" size="sm" className="justify-start font-mono" onClick={() => handleAction('fix')} disabled={runAction.isPending || !activeFile}>
          <Play className="w-3 h-3 mr-2 text-destructive" /> Find Bugs
        </Button>
        <Button variant="outline" size="sm" className="justify-start font-mono" onClick={() => handleAction('optimize')} disabled={runAction.isPending || !activeFile}>
          <RefreshCw className="w-3 h-3 mr-2 text-success" /> Optimize
        </Button>
        <Button variant="outline" size="sm" className="justify-start font-mono" onClick={() => handleAction('document')} disabled={runAction.isPending || !activeFile}>
          <File className="w-3 h-3 mr-2 text-purple" /> Document
        </Button>
        <Button variant="outline" size="sm" className="justify-start font-mono col-span-2" onClick={() => handleAction('tests')} disabled={runAction.isPending || !activeFile}>
          <Check className="w-3 h-3 mr-2 text-warning" /> Generate Tests
        </Button>
      </div>

      {runAction.isPending && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <span className="text-sm font-mono">Analyzing code...</span>
        </div>
      )}

      {result && !runAction.isPending && (
        <div className="bg-card/50 border border-border/50 rounded-md p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm capitalize">{result.action} Result</h4>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">{result.tokensUsed} tokens</Badge>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setResult(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-sm font-sans">
            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(result.explanation) }} />
          </div>

          {/* Diff viewer for code-changing actions */}
          {hasDiff && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground">Suggested Changes</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setResult(null)}
                  >
                    <X className="w-3 h-3 mr-1" /> Reject
                  </Button>
                  <Button
                    variant="success"
                    size="xs"
                    onClick={() => {
                      onApply?.(result.suggestedCode)
                      setResult(null)
                    }}
                  >
                    <Check className="w-2.5 h-2.5 mr-1" /> Apply
                  </Button>
                </div>
              </div>
              <InlineDiff original={editorContent ?? ''} revised={result.suggestedCode} />
            </div>
          )}

          {/* For tests/explain: show plain code block */}
          {result.suggestedCode && !hasDiff && (
            <div className="space-y-2 pt-4 border-t border-border/50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground">Generated Code</span>
                <Button
                  variant="success"
                  size="xs"
                  onClick={() => onApply?.(result.suggestedCode)}
                >
                  <Check className="w-2.5 h-2.5 mr-1" /> Insert
                </Button>
              </div>
              <div className="bg-black/50 p-3 rounded-md overflow-x-auto text-xs font-mono text-foreground border border-border/50 max-h-64">
                <pre><code>{result.suggestedCode}</code></pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Side-by-side inline diff rendered as +/- colored lines */
function InlineDiff({ original, revised }: { original: string; revised: string }) {
  const origLines = original.split('\n')
  const revLines = revised.split('\n')
  const maxLen = Math.max(origLines.length, revLines.length)

  const rows: { type: 'same' | 'add' | 'remove'; content: string }[] = []
  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i]
    const r = revLines[i]
    if (o === undefined) {
      rows.push({ type: 'add', content: r })
    } else if (r === undefined) {
      rows.push({ type: 'remove', content: o })
    } else if (o !== r) {
      rows.push({ type: 'remove', content: o })
      rows.push({ type: 'add', content: r })
    } else {
      rows.push({ type: 'same', content: o })
    }
  }

  return (
    <div className="rounded-sm overflow-hidden border border-border/50 text-xs font-mono max-h-72 overflow-y-auto bg-card">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            'px-3 py-0.5 leading-5 whitespace-pre-wrap break-all',
            row.type === 'add' && 'bg-success/10 text-success',
            row.type === 'remove' && 'bg-destructive/10 text-destructive',
            row.type === 'same' && 'text-muted-foreground/50',
          )}
        >
          <span className="select-none mr-2 opacity-60">
            {row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' '}
          </span>
          {row.content}
        </div>
      ))}
    </div>
  )
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatMarkdown(text: string) {
  if (!text) return ""
  // Escape HTML first to prevent XSS, then apply safe markdown transforms
  const escaped = escapeHtml(text)
  return escaped
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-black/50 p-2 rounded border border-border/50 overflow-x-auto text-xs font-mono mt-2 mb-2"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-primary">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
}
