import type { ReactNode } from 'react'

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'img'; alt: string; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'audio'; src: string }

const VIDEO_EXT_RE = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|weba)(\?|#|$)/i

function isSafeMediaSrc(src: string): boolean {
  const s = src.trim()
  if (/^\s*javascript:/i.test(s) || /^\s*vbscript:/i.test(s)) return false
  if (/^\s*data:/i.test(s)) return /^data:(image|video|audio)\/(png|jpe?g|gif|webp|avif|mp4|webm|ogg|mp3|wav|flac|aac|opus|x-m4[av]);base64,/i.test(s)
  if (/^\s*blob:/i.test(s)) return true  // blob: URLs are always same-origin (created by our own code)
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return true
  try {
    const u = new URL(s, typeof window !== 'undefined' ? window.location.origin : 'https://local.invalid')
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function mediaSrcKind(src: string): 'img' | 'video' | 'audio' {
  const s = src.trim()
  if (/^data:video\//i.test(s) || VIDEO_EXT_RE.test(s)) return 'video'
  if (/^data:audio\//i.test(s) || AUDIO_EXT_RE.test(s)) return 'audio'
  return 'img'
}

/** Parse markdown images + `<video src>` / `<audio src>` tags from assistant text. */
export function parseThreadMarkdownImages(text: string): Segment[] {
  // Combined: markdown images AND inline video/audio HTML tags
  const re = /!\[([^\]]*)\]\(([^)\s]+)\)|<(video|audio)[^>]*\bsrc="([^"]+)"[^>]*>/gi
  const out: Segment[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: 'text', value: text.slice(last, m.index) })
    }
    if (m[0].startsWith('!')) {
      // Markdown image: ![alt](src)
      const src = (m[2] ?? '').trim()
      const alt = (m[1] ?? '').trim()
      const kind = mediaSrcKind(src)
      if (kind === 'video') out.push({ kind: 'video', src })
      else if (kind === 'audio') out.push({ kind: 'audio', src })
      else out.push({ kind: 'img', alt, src })
    } else {
      // HTML tag: <video src="..."> or <audio src="...">
      const tag = (m[3] ?? '').toLowerCase() as 'video' | 'audio'
      const src = (m[4] ?? '').trim()
      out.push({ kind: tag, src })
    }
    last = m.index + m[0].length
  }
  if (last < text.length) {
    out.push({ kind: 'text', value: text.slice(last) })
  }
  if (out.length === 0) {
    out.push({ kind: 'text', value: text })
  }
  return out
}

export function ThreadAssistantRichText(props: { text: string }): ReactNode {
  const segments = parseThreadMarkdownImages(props.text)
  return (
    <>
      {segments.map((s, i) => {
        if (s.kind === 'text') return <span key={i}>{s.value}</span>
        if (!isSafeMediaSrc(s.src)) {
          return (
            <span key={i} className="hint">
              (unsafe URL omitted)
            </span>
          )
        }
        if (s.kind === 'video') {
          return (
            <video
              key={i}
              src={s.src}
              className="chat-workspace__thread-msg-inline-video"
              controls
              playsInline
              preload="metadata"
              aria-label="Model output video"
            />
          )
        }
        if (s.kind === 'audio') {
          return (
            <audio
              key={i}
              src={s.src}
              className="chat-workspace__thread-msg-inline-audio"
              controls
              preload="metadata"
              aria-label="Model output audio"
            />
          )
        }
        return (
          <img
            key={i}
            src={s.src}
            alt={(s as { alt?: string }).alt || 'Illustration'}
            className="chat-workspace__thread-msg-inline-img"
            loading="lazy"
            decoding="async"
          />
        )
      })}
    </>
  )
}
