import { useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Main control panel
// ---------------------------------------------------------------------------

export function Controls({
  vehicleId,
  vehicleState,
  onStateChange,
  onUserVehicleInteraction,
  onCameraPreset,
  apiUrl,
  authFetch = fetch,
  onOpenModelSettings,
  sceneInventory,
  partPickEnabled,
  onPartPickModeChange,
}) {
  const inventoryReady = sceneInventory != null
  const hasBrakeLights =
    !inventoryReady || (sceneInventory.matches?.brakeLights?.length ?? 0) > 0
  const hasDoors =
    !inventoryReady || (sceneInventory.matches?.doors?.length ?? 0) > 0
  const [pending, setPending]     = useState(null)
  const [localSpeed, setLocalSpeed] = useState(vehicleState.speed ?? 0)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
  }, [vehicleId])

  useEffect(() => {
    setLocalSpeed(vehicleState.speed ?? 0)
  }, [vehicleId, vehicleState.speed])

  /**
   * Optimistic toggle: update local state immediately, then sync with backend.
   * On backend failure, revert to previous state.
   */
  // Debounced speed POST — updates locally on every slider tick,
  // only sends to API 300ms after the user stops dragging
  const handleSpeedChange = useCallback((value) => {
    onUserVehicleInteraction?.()
    const num = Number(value)
    setLocalSpeed(num)
    onStateChange({ ...vehicleState, speed: num })

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authFetch(`${apiUrl}/vehicle/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehicleId, speed: num }),
        })
        const data = await res.json()
        onStateChange(data)
      } catch { /* keep local state on failure */ }
    }, 300)
  }, [vehicleState, onStateChange, apiUrl, vehicleId, onUserVehicleInteraction, authFetch])

  const toggle = async (key) => {
    if (pending) return
    onUserVehicleInteraction?.()

    const next = { ...vehicleState, [key]: !vehicleState[key] }
    onStateChange(next)   // optimistic
    setPending(key)

    try {
      const res = await authFetch(`${apiUrl}/vehicle/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, [key]: next[key] }),
      })
      const data = await res.json()
      onStateChange(data) // confirmed
    } catch {
      onStateChange(vehicleState) // revert
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className="pointer-events-auto absolute z-20 flex touch-manipulation select-none flex-col gap-3 sm:top-6 sm:right-6 sm:w-56 max-sm:inset-x-3 max-sm:top-auto max-sm:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-sm:max-h-[min(30vh,260px)] max-sm:w-auto max-sm:gap-2 max-sm:overflow-y-auto max-sm:overscroll-y-contain max-sm:rounded-xl max-sm:border max-sm:border-cyan-500/20 max-sm:bg-black/65 max-sm:px-2 max-sm:py-2 max-sm:shadow-[0_-8px_32px_rgba(0,0,0,0.45)] max-sm:backdrop-blur-md"
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-orbitron text-xs font-bold uppercase tracking-[0.15em] text-cyan-300 sm:text-sm sm:tracking-[0.2em]">
              Vehicle Control
            </p>
            <p className="mt-0.5 font-orbitron text-[9px] tracking-[0.25em] text-cyan-700 sm:text-[10px] sm:tracking-[0.3em]">
              JARVIS v1.0
            </p>
          </div>
          {/* Animated pulse dot */}
          <div className="w-8 h-8 rounded border border-cyan-500/30 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-cyan-400 animate-pulse" />
          </div>
        </div>
      </Panel>

      {/* ── System toggles ─────────────────────────────────────────────── */}
      <Panel label="SYSTEMS">
        <div className="flex flex-col gap-2">
          <ToggleButton
            label="Brake Lights"
            active={vehicleState.brakeLights}
            loading={pending === 'brakeLights'}
            color="red"
            disabled={!hasBrakeLights}
            onClick={() => toggle('brakeLights')}
          />
          <ToggleButton
            label="Doors"
            active={vehicleState.doorsOpen}
            loading={pending === 'doorsOpen'}
            color="cyan"
            disabled={!hasDoors}
            onClick={() => toggle('doorsOpen')}
          />
          {onOpenModelSettings && (
            <button
              type="button"
              onClick={onOpenModelSettings}
              className="min-h-[40px] rounded border border-cyan-500/35 px-3 py-2 font-orbitron text-[9px] uppercase tracking-widest text-cyan-500/90 transition-all hover:bg-cyan-500/10 sm:min-h-0"
            >
              Model settings…
            </button>
          )}
          {onPartPickModeChange && (
            <button
              type="button"
              onClick={() => onPartPickModeChange(!partPickEnabled)}
              className={`min-h-[40px] rounded border px-3 py-2 font-orbitron text-[9px] uppercase tracking-widest transition-all sm:min-h-0 ${
                partPickEnabled
                  ? 'border-amber-400/60 bg-amber-500/15 text-amber-200'
                  : 'border-gray-600/60 text-gray-400 hover:border-cyan-500/40 hover:text-cyan-400'
              }`}
            >
              {partPickEnabled ? 'Exit part picker' : 'Pick parts (info)'}
            </button>
          )}
          {partPickEnabled && (
            <p className="font-orbitron text-[8px] leading-relaxed text-cyan-900">
              Click a mesh: shows how it ties to Speed, Doors, or Brake lights. Scroll still zooms; rotate/pan are off until you exit.
            </p>
          )}
        </div>
      </Panel>

      {/* ── Speed control ──────────────────────────────────────────────── */}
      <Panel label="SPEED">
        {/* Digital readout */}
        <div className="flex items-end justify-between mb-3">
          <span
            className={`font-orbitron text-3xl font-bold tabular-nums tracking-tight
              ${localSpeed === 0 ? 'text-gray-600' :
                localSpeed < 80  ? 'text-green-400' :
                localSpeed < 150 ? 'text-yellow-400' : 'text-red-400'}`}
          >
            {String(localSpeed).padStart(3, '0')}
          </span>
          <span className="font-orbitron text-[10px] text-cyan-700 tracking-widest mb-1">KM/H</span>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={200}
          step={1}
          value={localSpeed}
          onChange={(e) => handleSpeedChange(e.target.value)}
          className="speed-slider h-2 w-full cursor-pointer appearance-none rounded py-2 sm:h-1 sm:py-0"
          style={{ '--val': `${(localSpeed / 200) * 100}%` }}
        />

        {/* Presets */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-1">
          {[0, 60, 120, 200].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleSpeedChange(v)}
              className={`min-h-[40px] rounded border px-1 py-2 font-orbitron text-[10px] uppercase tracking-widest transition-all duration-150 sm:min-h-0 sm:py-1 sm:text-[9px]
                ${localSpeed === v
                  ? 'bg-cyan-500/20 border-cyan-500/70 text-cyan-300'
                  : 'border-gray-700/50 text-gray-600 hover:border-gray-600 hover:text-gray-400'
                }`}
            >
              {v === 0 ? 'STOP' : v}
            </button>
          ))}
        </div>
      </Panel>

      {/* ── Camera presets ─────────────────────────────────────────────── */}
      <Panel label="CAMERA">
        <div className="grid grid-cols-2 gap-2 sm:gap-1.5">
          {['front', 'side', 'top', 'default'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onCameraPreset(preset)}
              className="min-h-[44px] rounded border border-cyan-500/30 px-2 py-2.5 font-orbitron text-[10px] uppercase tracking-widest text-cyan-400 transition-all duration-150 sm:min-h-0 sm:py-1.5
                         hover:bg-cyan-500/20 hover:border-cyan-400/60 hover:text-cyan-300 active:bg-cyan-500/25"
            >
              {preset}
            </button>
          ))}
        </div>
      </Panel>

      {/* ── Live state readout (hide on narrow screens to save vertical space) ─ */}
      <Panel label="STATE VECTOR" className="max-sm:hidden">
        <div className="space-y-1.5">
          {Object.entries(vehicleState).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="font-orbitron text-[10px] text-cyan-800 tracking-wider uppercase">
                {key.replace(/([A-Z])/g, ' $1')}
              </span>
              <span
                className={`font-orbitron text-[10px] font-bold tracking-widest ${
                  val === true     ? 'text-cyan-400' :
                  val === false    ? 'text-gray-600'  :
                  typeof val === 'number' && val > 0 ? 'text-green-400' : 'text-gray-600'
                }`}
              >
                {typeof val === 'number' ? `${val} KMH` : String(val).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </Panel>

    </div>
  )
}

// ---------------------------------------------------------------------------
// Reusable glassmorphism panel
// ---------------------------------------------------------------------------

function Panel({ children, label, className = '' }) {
  return (
    <div
      className={`rounded-lg border border-cyan-500/20 bg-black/50 p-3 shadow-[0_0_24px_rgba(0,255,255,0.04)] backdrop-blur-md sm:p-4 ${className}`}
    >
      {label && (
        <p className="font-orbitron text-[9px] text-cyan-700 tracking-[0.4em] uppercase mb-3">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggle button with per-color active styles
// ---------------------------------------------------------------------------

const COLOR_MAP = {
  red: {
    active:   'bg-red-500/15   border-red-500/70   text-red-400   shadow-[0_0_14px_rgba(239,68,68,0.25)]',
    inactive: 'border-gray-700/50 text-gray-600 hover:border-gray-600/70 hover:text-gray-500'
  },
  cyan: {
    active:   'bg-cyan-500/15  border-cyan-500/70  text-cyan-400  shadow-[0_0_14px_rgba(0,255,255,0.15)]',
    inactive: 'border-gray-700/50 text-gray-600 hover:border-gray-600/70 hover:text-gray-500'
  },
  green: {
    active:   'bg-green-500/15 border-green-500/70 text-green-400 shadow-[0_0_14px_rgba(34,197,94,0.15)]',
    inactive: 'border-gray-700/50 text-gray-600 hover:border-gray-600/70 hover:text-gray-500'
  }
}

function ToggleButton({ label, active, loading, color, onClick, disabled }) {
  const style = active ? COLOR_MAP[color].active : COLOR_MAP[color].inactive

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex min-h-[44px] items-center justify-between rounded border px-3 py-2.5 font-orbitron transition-all duration-200 active:opacity-90 sm:min-h-0 sm:py-2
                  ${style}
                  ${loading || disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
    >
      <span className="text-[10px] uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1.5">
        {loading && (
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
        )}
        <span className={`text-[10px] font-bold tracking-widest ${active ? 'opacity-100' : 'opacity-25'}`}>
          {active ? 'ON' : 'OFF'}
        </span>
      </div>
    </button>
  )
}
