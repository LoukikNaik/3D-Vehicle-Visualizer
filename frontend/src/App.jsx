import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Scene } from './Scene'
import { Controls } from './Controls'
import { VehicleSelector } from './VehicleSelector'
import { ModelSettingsModal } from './ModelSettingsModal'
import { PartInfoPanel } from './PartInfoPanel'
import { VEHICLES } from './vehicles'
import { useAuth } from './AuthContext'
import {
  getModelPresetKey,
  loadModelPreset,
  applyUserPreset,
  fetchModelPresetsMap,
} from './modelPresetStorage'
const POLL_INTERVAL = 500
/** Ignore poll overwrite briefly after slider/toggle so debounced speed POST can land first */
const POLL_AFTER_INTERACTION_GUARD_MS = Math.max(POLL_INTERVAL, 300) + 250

const DEFAULT_STATE = {
  brakeLights: false,
  doorsOpen:   false,
  speed:       0
}

export default function App() {
  const { apiBase, authFetch, logout } = useAuth()

  /** Per-vehicle control state (brakes / doors / speed), keyed by vehicle.id */
  const [vehicleStates, setVehicleStates] = useState({})
  const [cameraPreset,    setCameraPreset]    = useState(null)
  const [backendOnline,   setBackendOnline]   = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLES[0])  // Ferrari default
  const [customVehicle,   setCustomVehicle]   = useState(null)          // uploaded GLB
  const [sceneInventory,  setSceneInventory]  = useState(null)
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false)
  const [presetRevision,  setPresetRevision]  = useState(0)
  const [partPickEnabled, setPartPickEnabled] = useState(false)
  const [pickedPart,      setPickedPart]      = useState(null)
  const [hingePickMode,   setHingePickMode]   = useState(false)
  const [hingeWorldDraft, setHingeWorldDraft] = useState(null)
  const [presetMap, setPresetMap] = useState({})
  const prevBlobUrl = useRef(null)
  const lastUserVehicleInteractionAtRef = useRef(0)

  // All vehicles shown in selector = built-ins + custom if uploaded
  const allVehicles = customVehicle
    ? [...VEHICLES, customVehicle]
    : VEHICLES

  const presetKey = useMemo(() => getModelPresetKey(selectedVehicle), [selectedVehicle])
  const savedPreset = useMemo(() => {
    if (!presetKey) return null
    if (Object.prototype.hasOwnProperty.call(presetMap, presetKey)) {
      return presetMap[presetKey] ?? null
    }
    return loadModelPreset(presetKey)
  }, [presetKey, presetMap, presetRevision])

  const effectiveVehicle = useMemo(
    () => applyUserPreset(selectedVehicle, savedPreset),
    [selectedVehicle, savedPreset],
  )

  const selectedVehicleId = selectedVehicle.id
  const vehicleState = useMemo(
    () => vehicleStates[selectedVehicleId] ?? DEFAULT_STATE,
    [vehicleStates, selectedVehicleId],
  )

  useEffect(() => {
    setSceneInventory(null)
    setPickedPart(null)
    setHingePickMode(false)
    setHingeWorldDraft(null)
  }, [selectedVehicle.path])

  const handlePartPicked = useCallback((info) => {
    setPickedPart(info)
  }, [])

  const handleCanvasPointerMissed = useCallback(() => {
    if (hingePickMode) {
      setHingePickMode(false)
      return
    }
    if (partPickEnabled) setPickedPart(null)
  }, [hingePickMode, partPickEnabled])

  const handleHingeWorldPicked = useCallback((payload) => {
    setHingePickMode(false)
    setHingeWorldDraft({
      x: payload.x,
      y: payload.y,
      z: payload.z,
      doorName: payload.doorName ?? null,
      key: Date.now(),
    })
    setModelSettingsOpen(true)
  }, [])

  const consumeHingeDraft = useCallback(() => {
    setHingeWorldDraft(null)
  }, [])

  const handleStartHingePick3D = useCallback(() => {
    setPartPickEnabled(false)
    setPickedPart(null)
    setModelSettingsOpen(false)
    setHingePickMode(true)
  }, [])

  const handlePartPickModeChange = useCallback((v) => {
    setPartPickEnabled(v)
    if (v) setHingePickMode(false)
  }, [])

  const handleSceneInventory = useCallback((inv) => {
    setSceneInventory(inv)
  }, [])

  const handlePresetSaved = useCallback(() => {
    setPresetRevision((r) => r + 1)
  }, [])

  // ── Mesh presets (server file + localStorage fallback) ────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await fetchModelPresetsMap(apiBase, authFetch)
      if (cancelled) return
      setPresetMap(data && typeof data === 'object' ? data : {})
    })()
    return () => {
      cancelled = true
    }
  }, [presetRevision, authFetch, apiBase])

  // ── Poll backend (state is per selected vehicle id) ──────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const q = new URLSearchParams({ vehicleId: selectedVehicleId })
        const res = await authFetch(`${apiBase}/vehicle/state?${q}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        const incoming = {
          brakeLights: data.brakeLights,
          doorsOpen: data.doorsOpen,
          speed: data.speed,
        }
        setVehicleStates((prev) => {
          const cur = prev[selectedVehicleId] ?? DEFAULT_STATE
          const fresh =
            Date.now() - lastUserVehicleInteractionAtRef.current >=
            POLL_AFTER_INTERACTION_GUARD_MS
          if (fresh) return { ...prev, [selectedVehicleId]: incoming }
          return { ...prev, [selectedVehicleId]: { ...incoming, ...cur } }
        })
        setBackendOnline(true)
      } catch {
        setBackendOnline(false)
      }
    }
    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [selectedVehicleId, authFetch, apiBase])

  // ── Vehicle selection ─────────────────────────────────────────────────────
  const handleSelectVehicle = useCallback((vehicle) => {
    setSelectedVehicle(vehicle)
  }, [])

  // ── GLB upload ───────────────────────────────────────────────────────────
  const handleUpload = useCallback(({ url, name, uploadMeta }) => {
    // Revoke previous blob URL to free memory
    if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current)
    prevBlobUrl.current = url

    const custom = {
      id:       'custom',
      name:     name || 'Custom Model',
      label:    'UPLOADED · GLB',
      path:     url,
      color:    '#aa44ff',
      overrides: { wheels: [], brakeLights: [], doors: [] }, // auto-detect
      _uploadMeta: uploadMeta ?? { name: name || 'upload.glb', size: 0 },
    }
    setCustomVehicle(custom)
    setSelectedVehicle(custom)
    console.log('[Upload] Model loaded. Check console for mesh hierarchy to configure overrides.')
  }, [])

  const handleStateChange = useCallback((s) => {
    setVehicleStates((prev) => ({ ...prev, [selectedVehicleId]: s }))
  }, [selectedVehicleId])

  const onUserVehicleInteraction = useCallback(() => {
    lastUserVehicleInteractionAtRef.current = Date.now()
  }, [])

  const handleCameraPreset = useCallback((preset) => {
    setCameraPreset(preset)
    setTimeout(() => setCameraPreset(null), 50)
  }, [])

  useEffect(() => {
    if (!hingePickMode) return
    const onKey = (e) => {
      if (e.key === 'Escape') setHingePickMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hingePickMode])

  return (
    <div className="relative h-dvh max-h-dvh w-full overflow-hidden bg-[#050510]">

      {/* Mobile: canvas only in the upper band so fixed UI doesn’t cover the vehicle */}
      <div className="absolute inset-x-0 top-0 z-0 sm:inset-0 max-sm:bottom-[min(48dvh,430px)]">
        <Scene
          vehicleState={vehicleState}
          cameraPreset={cameraPreset}
          modelPath={effectiveVehicle.path}
          vehicleOverrides={effectiveVehicle.overrides}
          vehicleConfig={effectiveVehicle}
          onSceneInventory={handleSceneInventory}
          partPickEnabled={partPickEnabled}
          onPartPicked={handlePartPicked}
          onPickMissed={handleCanvasPointerMissed}
          hingePickEnabled={hingePickMode}
          onHingeWorldPicked={handleHingeWorldPicked}
        />
        {hingePickMode && (
          <div className="pointer-events-none absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-50 max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-lg border border-amber-500/40 bg-[#0a0a14]/95 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
            <p className="font-orbitron text-[10px] font-bold uppercase tracking-widest text-amber-200">
              Hinge pick
            </p>
            <p className="mt-1 font-orbitron text-[9px] leading-snug text-amber-100/85">
              Click the door on the hinge edge (vertical seam). Scroll = zoom only. Esc = cancel.
            </p>
          </div>
        )}
        <PartInfoPanel
          info={pickedPart}
          pickModeActive={partPickEnabled}
          onClose={() => setPickedPart(null)}
        />
      </div>

      <Controls
        vehicleId={selectedVehicleId}
        vehicleState={vehicleState}
        onStateChange={handleStateChange}
        onUserVehicleInteraction={onUserVehicleInteraction}
        onCameraPreset={handleCameraPreset}
        apiUrl={apiBase}
        authFetch={authFetch}
        onOpenModelSettings={() => setModelSettingsOpen(true)}
        sceneInventory={sceneInventory}
        partPickEnabled={partPickEnabled}
        onPartPickModeChange={handlePartPickModeChange}
      />

      <ModelSettingsModal
        open={modelSettingsOpen}
        onClose={() => setModelSettingsOpen(false)}
        vehicle={selectedVehicle}
        storedPreset={savedPreset}
        sceneInventory={sceneInventory}
        onPresetSaved={handlePresetSaved}
        hingeWorldDraft={hingeWorldDraft}
        onConsumeHingeDraft={consumeHingeDraft}
        onStartHingePick3D={handleStartHingePick3D}
        apiUrl={apiBase}
        authFetch={authFetch}
      />

      <VehicleSelector
        vehicles={allVehicles}
        selectedId={selectedVehicle.id}
        onSelect={handleSelectVehicle}
        onUpload={handleUpload}
      />

      {/* Status bar */}
      <div
        className="pointer-events-none absolute bottom-6 left-6 z-10 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 max-sm:bottom-auto max-sm:left-3 max-sm:top-[max(0.75rem,env(safe-area-inset-top))] max-sm:gap-2"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
            backendOnline
              ? 'bg-cyan-400 shadow-[0_0_6px_rgba(0,255,255,0.8)]'
              : 'bg-red-500'
          }`} />
          <span className="font-orbitron text-[10px] text-cyan-700 tracking-widest">
            {backendOnline ? 'API ONLINE' : 'API OFFLINE'}
          </span>
        </div>
        <span className="font-orbitron text-[10px] text-cyan-900 tracking-widest">
          VEHICLE_VIZ v1.0
        </span>
        <button
          type="button"
          onClick={logout}
          className="pointer-events-auto font-orbitron text-[9px] uppercase tracking-widest text-cyan-600 hover:text-cyan-400"
        >
          Sign out
        </button>
      </div>

      {/* Corner brackets — subtler on small screens */}
      <div className="pointer-events-none max-sm:opacity-30">
        <div className="absolute left-0 top-0 h-10 w-10 border-l-2 border-t-2 border-cyan-500/25 sm:h-12 sm:w-12" />
        <div className="absolute right-0 top-0 h-10 w-10 border-r-2 border-t-2 border-cyan-500/25 sm:h-12 sm:w-12" />
        <div className="absolute bottom-0 left-0 h-10 w-10 border-b-2 border-l-2 border-cyan-500/25 sm:h-12 sm:w-12" />
        <div className="absolute bottom-0 right-0 h-10 w-10 border-b-2 border-r-2 border-cyan-500/25 sm:h-12 sm:w-12" />
      </div>

    </div>
  )
}
