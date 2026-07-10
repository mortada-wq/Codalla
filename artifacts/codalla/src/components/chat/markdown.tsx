import * as React from "react"

function formatMarkdown(text: string): string {
  if (!text) return ""
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="bg-black/60 border border-white/10 rounded-md p-3 overflow-x-auto my-2"><code class="language-${lang || ""} text-xs font-mono text-cyan-300">${code}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="bg-white/10 rounded px-1 font-mono text-xs text-cyan-300">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, '<h3 class="text-xs font-semibold mt-3 mb-1 font-sans">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-semibold mt-3 mb-1 font-sans">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-sm font-bold mt-3 mb-1 font-sans">$1</h1>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, "<br/>")
}

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div
      className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground"
      dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${formatMarkdown(content)}</p>` }}
    />
  )
}
