import { useCallback, useEffect, useRef, useState } from 'react'

/** Minimal typings; DOM lib may omit SpeechRecognition in some TS setups. */
interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
}

interface SpeechRecognitionEventMap {
  result: Event & {
    resultIndex: number
    results: SpeechRecognitionResultList
  }
  error: Event & { error: string }
  end: Event
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: SpeechRecognitionEventMap['result']) => void) | null
  onerror: ((ev: SpeechRecognitionEventMap['error']) => void) | null
  onend: ((ev: SpeechRecognitionEventMap['end']) => void) | null
}

type RecognitionCtor = new () => BrowserSpeechRecognition

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function pickLang(): string {
  if (typeof document !== 'undefined' && document.documentElement.lang?.trim()) {
    return document.documentElement.lang.trim()
  }
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language
  return 'en-US'
}

/**
 * Browser-only speech-to-text via Web Speech API (Chrome/Edge/Safari).
 * Appends finalized phrases via `onFinalPhrase`.
 */
export function useBrowserSpeechToText(onFinalPhrase: (text: string) => void): {
  supported: boolean
  listening: boolean
  toggle: () => void
} {
  const phraseRef = useRef(onFinalPhrase)
  phraseRef.current = onFinalPhrase

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const [supported] = useState(
    () => typeof window !== 'undefined' && getRecognitionCtor() !== null,
  )
  const [listening, setListening] = useState(false)

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = pickLang()

    rec.onresult = (event: SpeechRecognitionEventMap['result']) => {
      let chunk = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const row = event.results[i]
        if (row.isFinal) chunk += row[0]?.transcript ?? ''
      }
      const t = chunk.trim()
      if (t) phraseRef.current(t)
    }

    rec.onerror = () => {
      setListening(false)
    }

    rec.onend = () => {
      setListening(false)
    }

    recognitionRef.current = rec

    return () => {
      try {
        rec.abort()
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null
    }
  }, [])

  const toggle = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return

    if (listening) {
      try {
        rec.stop()
      } catch {
        setListening(false)
      }
      return
    }

    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [listening])

  return { supported, listening, toggle }
}
