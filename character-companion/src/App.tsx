import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Scene } from './Scene'
import { DEFAULT_STATE, type CharacterState } from './types'
import { describeState, mergeState, parsePrompt } from './promptParser'
import './App.css'

class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message || '3D failed' }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="webgl-fallback">
          <img src={`${import.meta.env.BASE_URL}character-ref.jpg`} alt="Character" />
          <p>3D nav pieejams šajā ierīcē. Prompti joprojām strādā statusā apakšā.</p>
          <p className="err">{this.state.error}</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<CharacterState>(DEFAULT_STATE)
  const controlsRef = useRef<any>(null)
  const debounceRef = useRef<number | null>(null)

  const status = useMemo(() => describeState(state), [state])

  const applyPrompt = useCallback((text: string) => {
    setState((prev) => mergeState(prev, parsePrompt(text, prev)))
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 400)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      applyPrompt(prompt)
    }, 400)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [prompt, applyPrompt])

  const resetCamera = () => {
    const c = controlsRef.current
    if (!c) return
    c.reset()
    c.target.set(0, 0.9, 0)
    c.update()
  }

  const resetCharacter = () => {
    setState(DEFAULT_STATE)
    setPrompt('')
  }

  return (
    <div className="app">
      <div className="canvas-wrap">
        <SceneErrorBoundary>
          <Scene state={state} controlsRef={controlsRef} />
        </SceneErrorBoundary>
      </div>

      {!ready && <div className="boot">Ielādē companion…</div>}

      <header className="top">
        <div>
          <h1>Character Companion</h1>
          <p className="sub">Raksti promptu — mainās clothes / shape / pose live</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={resetCamera}>
            Reset camera
          </button>
          <button type="button" className="ghost" onClick={resetCharacter}>
            Reset character
          </button>
        </div>
      </header>

      <div className="status-chip" title={status}>
        {status}
      </div>

      <form
        className="prompt-bar"
        onSubmit={(e) => {
          e.preventDefault()
          applyPrompt(prompt)
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='Try: "put on a red dress" · "stand up" · "more muscular"'
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit">Apply</button>
      </form>

      <div className="hints">
        <button type="button" onClick={() => setPrompt('put on a red dress and stand')}>
          red dress
        </button>
        <button type="button" onClick={() => setPrompt('wear a bikini, sit up')}>
          bikini
        </button>
        <button type="button" onClick={() => setPrompt('jeans and hoodie, wave')}>
          casual
        </button>
        <button type="button" onClick={() => setPrompt('remove clothes, lie down')}>
          undress
        </button>
        <button type="button" onClick={() => setPrompt('taller, more muscular, slimmer waist')}>
          reshape
        </button>
        <button type="button" onClick={() => setPrompt('blonde ponytail, brighter lights')}>
          hair + light
        </button>
      </div>
    </div>
  )
}
