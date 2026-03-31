import { useAuth } from './AuthContext'
import { LoginScreen } from './LoginScreen'
import App from './App'

export function AuthShell() {
  const { phase, statusError, retryWithNewUrl } = useAuth()

  if (phase === 'loading-status') {
    return (
      <div className="flex h-dvh items-center justify-center bg-[#050510] font-orbitron text-xs uppercase tracking-widest text-cyan-800">
        Connecting…
      </div>
    )
  }

  if (phase === 'blocked') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[#050510] px-6 text-center">
        <p className="font-orbitron text-sm text-red-400/90">Cannot reach API</p>
        <p className="max-w-md font-orbitron text-[10px] text-cyan-900">{statusError}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={retryWithNewUrl}
            className="rounded border border-cyan-500/40 px-4 py-2 font-orbitron text-[10px] uppercase tracking-widest text-cyan-400"
          >
            Different URL
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded border border-gray-600 px-4 py-2 font-orbitron text-[10px] uppercase tracking-widest text-gray-500"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'need-login') {
    return (
      <>
        <LoginScreen />
      </>
    )
  }

  return <App />
}
