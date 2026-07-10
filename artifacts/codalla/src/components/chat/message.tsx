import * as React from "react"
import { MarkdownPreview } from "./markdown"
import { cn } from "@/lib/utils"

export function ChatMessage({ message }: { message: any }) {
  const isUser = message.role === "user"
  const isSystem = message.role === "system"

  if (isSystem) return null

  return (
    <div className={cn(
      "px-4 py-3 group",
      isUser
        ? "bg-transparent"
        : "bg-card/40 border-y border-border/40"
    )}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className={cn(
          "shrink-0 w-5 h-5 mt-0.5 rounded-sm flex items-center justify-center font-mono text-xs font-bold",
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-info/20 text-info"
        )}>
          {isUser ? "U" : "A"}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-xs font-sans font-semibold",
              isUser ? "text-primary/70" : "text-info/70"
            )}>
              {isUser ? "you" : "assistant"}
            </span>
            {!isUser && message.cost > 0 && (
              <span className="text-xs font-mono text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
                ${message.cost?.toFixed(5)} · {message.tokensUsed}t
              </span>
            )}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed
            prose-p:my-1.5 prose-headings:font-sans prose-headings:text-foreground
            prose-code:font-mono prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded-sm prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px]
            prose-pre:bg-card prose-pre:border prose-pre:border-border/60 prose-pre:rounded-sm prose-pre:my-2
            prose-a:text-info prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground
            prose-strong:text-foreground prose-strong:font-semibold
            prose-li:my-0.5">
            <MarkdownPreview content={message.content} />
          </div>
        </div>
      </div>
    </div>
  )
}
