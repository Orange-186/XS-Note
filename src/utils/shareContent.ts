export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const parts: string[] = []
  let inCode = false
  let codeLines: string[] = []

  const flushCode = () => {
    if (codeLines.length === 0) return
    parts.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    codeLines = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        inCode = true
      }
      continue
    }

    if (inCode) {
      codeLines.push(line)
      continue
    }

    if (!line.trim()) {
      parts.push('<br />')
      continue
    }

    if (/^#{1,3}\s+/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1
      const text = line.replace(/^#{1,3}\s+/, '')
      const tag = level <= 1 ? 'h2' : level === 2 ? 'h3' : 'h4'
      parts.push(`<${tag}>${inlineMarkdown(text)}</${tag}>`)
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      parts.push(`<p>• ${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</p>`)
      continue
    }

    parts.push(`<p>${inlineMarkdown(line)}</p>`)
  }

  flushCode()
  return parts.join('\n')
}

function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function encodeUtf8WithBom(content: string): Uint8Array {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const body = new TextEncoder().encode(content)
  const combined = new Uint8Array(bom.length + body.length)
  combined.set(bom)
  combined.set(body, bom.length)
  return combined
}

export function encodeUtf8(content: string): Uint8Array {
  return new TextEncoder().encode(content)
}
