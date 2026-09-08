import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fal } from '@fal-ai/client'
import './App.css'

const FAL_KEY_STORAGE = 'companion_fal_key'
const MODEL = 'fal-ai/flux/dev/image-to-image'
const LIVE_REF =
  'https://vezitivus.github.io/APP/companion/character-ref.jpg'
const LOCAL_REF = `${import.meta.env.BASE_URL}character-ref.jpg`
const PROMPT_PREFIX =
  'Keep the likeness of the reference woman, photorealistic, natural skin, detailed face. '

type StatusKind = 'idle' | 'ready' | 'queued' | 'generating' | 'done' | 'error' | 'need-key'

type HistoryItem = {
  id: string
  url: string
  prompt: string
  strength: number
  at: number
}

type GenResult = {
  images?: { url: string }[]
  image?: { url: string }
}

function readStoredKey(): string {
  try {
    return localStorage.getItem(FAL_KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

function writeStoredKey(value: string) {
  try {
    if (value) localStorage.setItem(FAL_KEY_STORAGE, value)
    else localStorage.removeItem(FAL_KEY_STORAGE)
  } catch {
    /* ignore quota / private mode */
  }
}

async function resolveImageUrl(preferLive: boolean): Promise<string> {
  if (preferLive) {
    try {
      const head = await fetch(LIVE_REF, { method: 'HEAD', mode: 'cors' })
      if (head.ok) return LIVE_REF
    } catch {
      /* fall through to upload */
    }
    try {
      const get = await fetch(LIVE_REF, { mode: 'cors' })
      if (get.ok) return LIVE_REF
    } catch {
      /* fall through */
    }
  }

  const res = await fetch(LOCAL_REF)
  if (!res.ok) throw new Error('Could not load reference image')
  const blob = await res.blob()
  const file = new File([blob], 'character-ref.jpg', {
    type: blob.type || 'image/jpeg',
  })
  return fal.storage.upload(file)
}

function extractImageUrl(data: GenResult): string | null {
  if (data.images?.[0]?.url) return data.images[0].url
  if (data.image?.url) return data.image.url
  return null
}

export default function App() {
  const [apiKey, setApiKey] = useState(readStoredKey)
  const [keyDraft, setKeyDraft] = useState(readStoredKey)
  const [showKeyPanel, setShowKeyPanel] = useState(!readStoredKey())
  const [prompt, setPrompt] = useState('wearing a soft linen dress in golden hour light')
  const [strength, setStrength] = useState(0.65)
  const [status, setStatus] = useState<StatusKind>(
    readStoredKey() ? 'ready' : 'need-key',
  )
  const [statusDetail, setStatusDetail] = useState(
    readStoredKey() ? 'Ready — type a prompt or press Apply' : 'Add your fal.ai API key',
  )
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [busy, setBusy] = useState(false)

  const genIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const promptRef = useRef(prompt)
  const strengthRef = useRef(strength)
  const apiKeyRef = useRef(apiKey)

  promptRef.current = prompt
  strengthRef.current = strength
  apiKeyRef.current = apiKey

  const displayRef = useMemo(() => LOCAL_REF, [])

  const applyKey = useCallback(() => {
    const trimmed = keyDraft.trim()
    writeStoredKey(trimmed)
    setApiKey(trimmed)
    if (trimmed) {
      fal.config({ credentials: trimmed })
      setShowKeyPanel(false)
      setStatus('ready')
      setStatusDetail('API key saved in this browser only')
    } else {
      setStatus('need-key')
      setStatusDetail('Add your fal.ai API key')
      setShowKeyPanel(true)
    }
  }, [keyDraft])

  useEffect(() => {
    if (apiKey) fal.config({ credentials: apiKey })
  }, [apiKey])

  const generate = useCallback(async (text: string, str: number) => {
    const key = apiKeyRef.current.trim()
    if (!key) {
      setStatus('need-key')
      setStatusDetail('Add your fal.ai API key first')
      setShowKeyPanel(true)
      return
    }

    const trimmed = text.trim()
    if (!trimmed) {
      setStatus('idle')
      setStatusDetail('Enter a prompt to generate')
      return
    }

    const id = ++genIdRef.current
    setBusy(true)
    fal.config({ credentials: key })

    try {
      setStatus('queued')
      setStatusDetail('Resolving reference image…')
      const image_url = await resolveImageUrl(true)
      if (id !== genIdRef.current) return

      setStatus('generating')
      setStatusDetail('Generating with Flux…')

      const fullPrompt = `${PROMPT_PREFIX}${trimmed}`
      const result = await fal.subscribe(MODEL, {
        input: {
          image_url,
          prompt: fullPrompt,
          strength: str,
          num_images: 1,
          enable_safety_checker: false,
          output_format: 'jpeg',
        },
        logs: false,
      })

      if (id !== genIdRef.current) return

      const url = extractImageUrl(result.data as GenResult)
      if (!url) throw new Error('No image returned from fal')

      setGeneratedUrl(url)
      setHistory((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            url,
            prompt: trimmed,
            strength: str,
            at: Date.now(),
          },
          ...prev,
        ].slice(0, 12),
      )
      setStatus('done')
      setStatusDetail('Done')
    } catch (err) {
      if (id !== genIdRef.current) return
      const msg = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusDetail(msg.slice(0, 180))
    } finally {
      if (id === genIdRef.current) setBusy(false)
    }
  }, [])

  const scheduleGenerate = useCallback(
    (text: string, str: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void generate(text, str)
      }, 1600)
    },
    [generate],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const onPromptChange = (value: string) => {
    setPrompt(value)
    if (!apiKeyRef.current.trim()) return
    if (!value.trim()) return
    setStatus('idle')
    setStatusDetail('Waiting to generate…')
    scheduleGenerate(value, strengthRef.current)
  }

  const onApply = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    void generate(promptRef.current, strengthRef.current)
  }

  const onStrengthChange = (value: number) => {
    setStrength(value)
    if (!apiKeyRef.current.trim() || !promptRef.current.trim()) return
    setStatus('idle')
    setStatusDetail('Waiting to generate…')
    scheduleGenerate(promptRef.current, value)
  }

  const statusLabel = useMemo(() => {
    switch (status) {
      case 'need-key':
        return 'API key needed'
      case 'ready':
        return 'Ready'
      case 'idle':
        return 'Idle'
      case 'queued':
        return 'Queued'
      case 'generating':
        return 'Generating'
      case 'done':
        return 'Done'
      case 'error':
        return 'Error'
      default:
        return status
    }
  }, [status])

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Character Flux</h1>
          <p className="sub">fal.ai Flux image-to-image · likeness from your reference</p>
        </div>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => setShowKeyPanel((v) => !v)}>
            {apiKey ? 'API key' : 'Add API key'}
          </button>
        </div>
      </header>

      <div className={`status-chip status-${status}`} title={statusDetail}>
        <span className="dot" />
        <strong>{statusLabel}</strong>
        <span className="detail">{statusDetail}</span>
      </div>

      {showKeyPanel && (
        <section className="key-panel" aria-label="fal API key">
          <div className="key-panel-inner">
            <h2>fal.ai API key</h2>
            <p>
              Stored only in this browser&apos;s localStorage (<code>{FAL_KEY_STORAGE}</code>).
              Never committed to the repo.
            </p>
            <div className="key-row">
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="fal_…"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyKey()
                }}
              />
              <button type="button" onClick={applyKey}>
                Save
              </button>
              {apiKey && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setKeyDraft('')
                    writeStoredKey('')
                    setApiKey('')
                    setStatus('need-key')
                    setStatusDetail('API key cleared')
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <p className="hint">
              Get a key at{' '}
              <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noreferrer">
                fal.ai/dashboard/keys
              </a>
            </p>
          </div>
        </section>
      )}

      <main className="stage">
        <figure className="frame">
          <figcaption>Reference</figcaption>
          <img src={displayRef} alt="Character reference" />
        </figure>
        <figure className={`frame result ${busy ? 'busy' : ''}`}>
          <figcaption>Generated</figcaption>
          {generatedUrl ? (
            <img src={generatedUrl} alt="Generated character" />
          ) : (
            <div className="placeholder">
              <span>Your Flux result appears here</span>
            </div>
          )}
        </figure>
      </main>

      {history.length > 0 && (
        <section className="history" aria-label="Generation history">
          {history.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.url === generatedUrl ? 'active' : ''}
              title={item.prompt}
              onClick={() => {
                setGeneratedUrl(item.url)
                setPrompt(item.prompt)
                setStrength(item.strength)
                setStatus('done')
                setStatusDetail('Restored from history')
              }}
            >
              <img src={item.url} alt="" />
            </button>
          ))}
        </section>
      )}

      <div className="controls">
        <label className="strength">
          <span>
            Strength <em>{strength.toFixed(2)}</em>
          </span>
          <input
            type="range"
            min={0.35}
            max={0.95}
            step={0.01}
            value={strength}
            onChange={(e) => onStrengthChange(Number(e.target.value))}
          />
        </label>

        <div className="prompt-bar">
          <input
            type="text"
            value={prompt}
            placeholder="Describe outfit, pose, scene…"
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApply()
            }}
            disabled={busy && status === 'generating'}
          />
          <button type="button" onClick={onApply} disabled={busy}>
            {busy ? '…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
