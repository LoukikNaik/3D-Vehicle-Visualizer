import { useState } from 'react'
import { useAuth } from './AuthContext'
import { DEV_DEFAULT_API_BASE_B64 } from './apiConfig'

export function LoginScreen() {
  const { login, loginError, isDev } = useAuth()
  const [encoded, setEncoded] = useState(() => (isDev ? DEV_DEFAULT_API_BASE_B64 : ''))
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (busy || !encoded.trim()) return
    setBusy(true)
    try {
      await login(encoded)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050510] px-4">
      <div className="w-full max-w-md rounded-xl border border-cyan-500/25 bg-black/60 p-6 shadow-[0_0_40px_rgba(0,255,255,0.06)] backdrop-blur-md">
        <h1 className="font-orbitron text-sm font-bold uppercase tracking-[0.2em] text-cyan-300">
          Vehicle control
        </h1>
        <p className="mt-2 font-orbitron text-[10px] leading-relaxed tracking-wide text-cyan-900">
          Enter your API key to connect Vehicle control to your backend.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block font-orbitron text-[9px] uppercase tracking-widest text-cyan-700">
            API key
            <textarea
              autoComplete="off"
              spellCheck={false}
              rows={3}
              value={encoded}
              onChange={(e) => setEncoded(e.target.value)}
              className="mt-1.5 w-full resize-y rounded border border-cyan-500/35 bg-black/50 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cyan-100 placeholder:text-gray-600 focus:border-cyan-400/60 focus:outline-none"
              placeholder="Paste your API key"
              disabled={busy}
            />
          </label>
          {loginError && (
            <p className="font-orbitron text-[10px] text-red-400/90">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={busy || !encoded.trim()}
            className="w-full rounded border border-cyan-500/60 bg-cyan-500/15 py-2.5 font-orbitron text-[10px] font-bold uppercase tracking-widest text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  )
}
