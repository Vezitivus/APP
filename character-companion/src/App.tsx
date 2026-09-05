import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Scene } from './Scene'
import { DEFAULT_STATE, type CharacterState } from './types'
import { describeState, mergeState, parsePrompt } from './promptParser'
import './App.css'

export default function App() {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<CharacterState>(DEFAULT_STATE)
  const controlsRef = useRef<any>(null)
  const debounceRef = useRef<number | null>(null)

  const status = useMemo(() => describeState(state), [state])

  const applyPrompt = useCallback((text: string) => {
    setState((prev) => mergeState(prev, parsePrompt(text, prev)))
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
        <Scene state={state} controlsRef={controlsRef} />
      </div>

      <header className="top">
        <div>
          <h1>Character Companion</h1>
          <p className="sub">Type and she reacts live — clothes, shape, pose, hair, light</p>
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
          placeholder='Try: "put on a red dress" · "stand up" · "more muscular" · "sunset vibe"'
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
