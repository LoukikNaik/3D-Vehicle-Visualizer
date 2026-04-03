import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  DEV_DEFAULT_API_BASE,
  decodeApiBaseFromLogin,
  normalizeApiBase,
} from './apiConfig'
import {
  clearStoredApiBase,
  getStoredApiBase,
  setStoredApiBase,
} from './apiAuth'

const AuthContext = createContext(null)

const isDev = import.meta.env.DEV

export function AuthProvider({ children }) {
  const [phase, setPhase] = useState('loading-status')
  const [apiBase, setApiBaseState] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [loginError, setLoginError] = useState(null)

  const bootstrapFromBase = useCallback(async (base, cancelledRef) => {
    const h = await fetch(`${base}/health`)
    if (!h.ok) throw new Error(`Server returned ${h.status}`)
    if (cancelledRef.cancelled) return
    setApiBaseState(base)
    setPhase('ready')
  }, [])

  useEffect(() => {
    const cancelledRef = { cancelled: false }
    setStatusError(null)
    ;(async () => {
      try {
        let base = null
        if (isDev) {
          base = getStoredApiBase() || DEV_DEFAULT_API_BASE
        } else {
          base = getStoredApiBase()
          if (!base) {
            setPhase('need-login')
            return
          }
        }
        await bootstrapFromBase(base, cancelledRef)
      } catch (e) {
        if (cancelledRef.cancelled) return
        setStatusError(e?.message || 'Network error')
        setPhase(isDev ? 'need-login' : 'blocked')
      }
    })()
    return () => {
      cancelledRef.cancelled = true
    }
  }, [bootstrapFromBase])

  const logout = useCallback(() => {
    clearStoredApiBase()
    setApiBaseState(null)
    setPhase('need-login')
  }, [])

  const retryWithNewUrl = useCallback(() => {
    clearStoredApiBase()
    setApiBaseState(null)
    setStatusError(null)
    setPhase('need-login')
  }, [])

  const login = useCallback(async (encodedBaseUrl) => {
    setLoginError(null)
    let base
    try {
      const decoded = decodeApiBaseFromLogin(encodedBaseUrl)
      base = normalizeApiBase(decoded)
    } catch (e) {
      setLoginError(e?.message || 'Invalid input')
      return false
    }
    try {
      const h = await fetch(`${base}/health`)
      if (!h.ok) {
        setLoginError(`Server unreachable (HTTP ${h.status})`)
        return false
      }
      setStoredApiBase(base)
      setApiBaseState(base)
      setPhase('ready')
      return true
    } catch {
      setLoginError('Network error — check the URL and try again')
      return false
    }
  }, [])

  const authFetch = useCallback((input, init = {}) => fetch(input, init), [])

  const value = useMemo(
    () => ({
      phase,
      apiBase: apiBase ?? '',
      authFetch,
      login,
      logout,
      loginError,
      statusError,
      isDev,
      retryWithNewUrl,
    }),
    [phase, apiBase, authFetch, login, logout, loginError, statusError, retryWithNewUrl],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
