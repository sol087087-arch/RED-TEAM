import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

/** Same-origin, http(s), or base64 data-URIs for safe media types (image/video/audio). */
function isSafeMediaSrc(src: string): boolean {
  const s = src.trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false
  if (lower.startsWith('data:')) return /^data:(image|video|audio)\//i.test(s)
  if (lower.startsWith('blob:')) return true  // blob: URLs are always same-origin (created by our own code)
  if (s.startsWith('/')) return true
  return /^https?:\/\//i.test(s)
}

const VIDEO_IN_URL_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i
const AUDIO_IN_URL_RE = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus|weba)(\?|#|$)/i

function isVideoFileUrl(url: string): boolean {
  return VIDEO_IN_URL_RE.test(url.trim())
}

function isAudioFileUrl(url: string): boolean {
  return AUDIO_IN_URL_RE.test(url.trim())
}

function isSafeLinkHref(href: string): boolean {
  const s = href.trim()
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return false
  if (s.startsWith('#')) return true
  if (s.startsWith('/')) return true
  return /^https?:\/\//i.test(s) || /^mailto:/i.test(s)
}

function tryPrettyJsonRoot(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  try {
    return JSON.stringify(JSON.parse(t), null, 2)
  } catch {
    return null
  }
}

const replySanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'video', 'audio', 'source'],
  attributes: {
    ...defaultSchema.attributes,
    video: [
      ...(defaultSchema.attributes?.video ?? []),
      'src',
      'controls',
      'loop',
      'muted',
      'playsinline',
      'preload',
      'poster',
      'width',
      'height',
      'className',
    ],
    audio: ['src', 'controls', 'loop', 'preload', 'className'],
    source: [...(defaultSchema.attributes?.source ?? []), 'src', 'type', 'media'],
  },
}

export function ReplyRichBody(props: { text: string; emptyLabel?: string }): ReactNode {
  const { text, emptyLabel = '(empty response)' } = props
  if (!text.trim()) return emptyLabel

  const jsonPretty = tryPrettyJsonRoot(text)
  if (jsonPretty !== null) {
    return (
      <div className="reply-window reply-window--md">
        <pre className="reply-md-pre reply-md-pre--json">
          <code className="reply-md-code-block language-json">{jsonPretty}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="reply-window reply-window--md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, replySanitizeSchema]]}
        components={{
          img({ src, alt }) {
            const s = (src ?? '').trim()
            if (!isSafeMediaSrc(s)) return null
            if (isVideoFileUrl(s)) {
              return (
                <video
                  className="reply-window__inline-video"
                  src={s}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={(alt ?? '').trim() || 'Model output video'}
                />
              )
            }
            if (isAudioFileUrl(s)) {
              return (
                <audio
                  className="reply-window__inline-audio"
                  src={s}
                  controls
                  preload="metadata"
                  aria-label={(alt ?? '').trim() || 'Model output audio'}
                />
              )
            }
            return (
              <img
                src={s}
                alt={(alt ?? '').trim() || 'Model output image'}
                className="reply-window__inline-img"
                loading="lazy"
                decoding="async"
              />
            )
          },
          video({ src, children, poster, loop, muted, width, height }) {
            const s = String(src ?? '').trim()
            if (s && !isSafeMediaSrc(s)) return null
            return (
              <video
                className="reply-window__inline-video"
                src={s || undefined}
                poster={
                  typeof poster === 'string' && isSafeMediaSrc(poster) ? poster.trim() : undefined
                }
                loop={Boolean(loop)}
                muted={Boolean(muted)}
                width={typeof width === 'number' || typeof width === 'string' ? width : undefined}
                height={typeof height === 'number' || typeof height === 'string' ? height : undefined}
                controls
                playsInline
                preload="metadata"
              >
                {children}
              </video>
            )
          },
          audio({ src, children, loop }) {
            const s = String(src ?? '').trim()
            if (s && !isSafeMediaSrc(s)) return null
            return (
              <audio
                className="reply-window__inline-audio"
                src={s || undefined}
                loop={Boolean(loop)}
                controls
                preload="metadata"
              >
                {children}
              </audio>
            )
          },
          source({ src, type, media }) {
            const s = String(src ?? '').trim()
            if (!s || !isSafeMediaSrc(s)) return null
            return <source src={s} type={type ?? undefined} media={media ?? undefined} />
          },
          a({ href, children }) {
            const h = (href ?? '').trim()
            if (!h || !isSafeLinkHref(h)) return <span className="reply-md-link-fallback">{children}</span>
            return (
              <a href={h} target="_blank" rel="noopener noreferrer" className="reply-md-a">
                {children}
              </a>
            )
          },
          pre({ children }) {
            return <pre className="reply-md-pre">{children}</pre>
          },
          code({ className, children, ...rest }) {
            const isBlock = Boolean(className?.includes('language-'))
            if (isBlock) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              )
            }
            return (
              <code className="reply-md-code-inline" {...rest}>
                {children}
              </code>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
