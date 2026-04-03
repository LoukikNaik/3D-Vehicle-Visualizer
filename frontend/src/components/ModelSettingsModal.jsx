import { useState, useEffect, useMemo } from 'react'
import {
  getModelPresetKey,
  loadModelPreset,
  saveModelPreset,
  clearModelPreset,
  persistModelPresetToServer,
} from '../modelPresetStorage'

const AXIS = ['x', 'y', 'z']

function Section({ title, children }) {
  return (
    <div className="border-b border-cyan-500/15 pb-4 mb-4 last:mb-0 last:border-0 last:pb-0">
      <h3 className="font-orbitron text-[10px] text-cyan-500 tracking-[0.3em] uppercase mb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function NamePicker({ label, nodeNames, selected, onChange, help }) {
  const [q, setQ] = useState('')
  const [custom, setCustom] = useState('')
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return nodeNames
    return nodeNames.filter((n) => n.toLowerCase().includes(s))
  }, [nodeNames, q])

  const toggle = (name) => {
    if (selected.includes(name)) onChange(selected.filter((x) => x !== name))
    else onChange([...selected, name])
  }

  return (
    <div className="space-y-2">
      <p className="font-orbitron text-[9px] text-gray-500">{label}</p>
      {help && <p className="font-orbitron text-[8px] text-cyan-900 leading-relaxed">{help}</p>}
      <input
        type="search"
        placeholder="Filter names…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded border border-cyan-500/25 bg-black/50 px-2 py-1.5 font-orbitron text-[10px] text-cyan-200 placeholder:text-gray-600"
      />
      <div className="max-h-36 overflow-y-auto rounded border border-gray-800/80 bg-black/40 p-2 space-y-1">
        {filtered.map((name) => (
          <label
            key={name}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-cyan-500/10"
          >
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => toggle(name)}
              className="rounded border-cyan-600/50"
            />
            <span className="font-orbitron text-[9px] text-gray-300 truncate">{name}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="font-orbitron text-[9px] text-gray-600">No matches</p>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Add name manually"
          className="min-w-0 flex-1 rounded border border-gray-700 bg-black/50 px-2 py-1 font-orbitron text-[9px] text-cyan-200"
        />
        <button
          type="button"
          onClick={() => {
            const t = custom.trim()
            if (!t || selected.includes(t)) return
            onChange([...selected, t])
            setCustom('')
          }}
          className="shrink-0 rounded border border-cyan-500/40 px-2 py-1 font-orbitron text-[9px] text-cyan-400"
        >
          Add
        </button>
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selected.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(selected.filter((x) => x !== n))}
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-orbitron text-[8px] text-cyan-300"
            >
              {n} ×
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function round4(n) {
  const v = Number(n)
  return Number.isFinite(v) ? Math.round(v * 10000) / 10000 : 0
}

/** Drop empty / invalid per-door entries before save */
function sanitizePerDoor(pd) {
  const out = {}
  for (const [k, v] of Object.entries(pd || {})) {
    if (!v || typeof v !== 'object') continue
    const o = { ...v }
    if (o.hingeMode === 'manualWorld') {
      if (!Array.isArray(o.hingeWorld) || o.hingeWorld.length !== 3) {
        delete o.hingeMode
        delete o.hingeWorld
      }
    }
    const keys = Object.keys(o).filter((key) => o[key] !== undefined && o[key] !== '')
    if (!keys.length) continue
    out[k] = o
  }
  return out
}

function doorHingeKind(perDoor, dn) {
  const p = perDoor[dn]
  if (!p) return 'useDefault'
  if (p.hingeMode === 'manualWorld' || (Array.isArray(p.hingeWorld) && p.hingeWorld.length === 3))
    return 'manualWorld'
  if (p.hingeMode === 'auto') return 'auto'
  return 'useDefault'
}

export function ModelSettingsModal({
  open,
  onClose,
  vehicle,
  storedPreset,
  sceneInventory,
  onPresetSaved,
  hingeWorldDraft,
  onConsumeHingeDraft,
  onStartHingePick3D,
  apiUrl,
  authFetch = fetch,
}) {
  const presetKey = vehicle ? getModelPresetKey(vehicle) : null

  const [wheels, setWheels] = useState([])
  const [presetSaving, setPresetSaving] = useState(false)
  const [doors, setDoors] = useState([])
  const [brakeLights, setBrakeLights] = useState([])
  const [wheelSpinLocalAxis, setWheelSpinLocalAxis] = useState('x')
  const [wheelSpinDefaultSign, setWheelSpinDefaultSign] = useState(-1)
  const [doorRotationAxis, setDoorRotationAxis] = useState('y')
  const [advOpen, setAdvOpen] = useState(false)
  const [hingeMode, setHingeMode] = useState('auto')
  const [hingeWorldX, setHingeWorldX] = useState('0')
  const [hingeWorldY, setHingeWorldY] = useState('0')
  const [hingeWorldZ, setHingeWorldZ] = useState('0')
  const [openAngleDeg, setOpenAngleDeg] = useState('60')
  const [doorAnimSpeed, setDoorAnimSpeed] = useState('3')
  const [perDoor, setPerDoor] = useState({})

  useEffect(() => {
    if (!open || !vehicle) return
    const disk =
      storedPreset !== undefined && storedPreset !== null
        ? storedPreset
        : presetKey
          ? loadModelPreset(presetKey)
          : null
    const base = vehicle.overrides ?? {}
    const po = disk?.overrides ?? {}
    setWheels(
      po.wheels?.length ? [...po.wheels] : [...(base.wheels ?? [])],
    )
    setDoors(
      po.doors?.length ? [...po.doors] : [...(base.doors ?? [])],
    )
    setBrakeLights(
      po.brakeLights?.length ? [...po.brakeLights] : [...(base.brakeLights ?? [])],
    )
    setWheelSpinLocalAxis(disk?.wheelSpinLocalAxis ?? vehicle.wheelSpinLocalAxis ?? 'x')
    setWheelSpinDefaultSign(disk?.wheelSpinDefaultSign ?? vehicle.wheelSpinDefaultSign ?? -1)
    setDoorRotationAxis(disk?.doorRotationAxis ?? vehicle.doorRotationAxis ?? 'y')
    const da = disk?.doorAdvanced ?? vehicle.doorAdvanced
    const defs = da?.defaults ?? {}
    setHingeMode(defs.hingeMode ?? 'auto')
    const hw = defs.hingeWorld
    setHingeWorldX(hw ? String(hw[0]) : '0')
    setHingeWorldY(hw ? String(hw[1]) : '0')
    setHingeWorldZ(hw ? String(hw[2]) : '0')
    setOpenAngleDeg(
      defs.openAngleDeg != null ? String(defs.openAngleDeg) : '60',
    )
    setDoorAnimSpeed(defs.animSpeed != null ? String(defs.animSpeed) : '3')
    const rawPd = da?.perDoor
    const builtInPd = vehicle?.doorAdvanced?.perDoor
    setPerDoor({
      ...(builtInPd && typeof builtInPd === 'object' ? builtInPd : {}),
      ...(rawPd && typeof rawPd === 'object' ? rawPd : {}),
    })
  }, [open, vehicle, presetKey, storedPreset])

  useEffect(() => {
    if (!open || !hingeWorldDraft?.key) return
    const { x, y, z, doorName } = hingeWorldDraft
    const hx = round4(x)
    const hy = round4(y)
    const hz = round4(z)
    if (doorName) {
      setPerDoor((prev) => ({
        ...prev,
        [doorName]: {
          ...(prev[doorName] ?? {}),
          hingeMode: 'manualWorld',
          hingeWorld: [hx, hy, hz],
        },
      }))
    } else {
      setHingeWorldX(String(round4(x)))
      setHingeWorldY(String(round4(y)))
      setHingeWorldZ(String(round4(z)))
      setHingeMode('manualWorld')
    }
    setAdvOpen(true)
    onConsumeHingeDraft?.()
  }, [open, hingeWorldDraft, onConsumeHingeDraft])

  const nodeNames = sceneInventory?.nodeNames ?? []

  const handleSave = async () => {
    if (!presetKey || presetSaving) return
    const hx = Number.parseFloat(hingeWorldX) || 0
    const hy = Number.parseFloat(hingeWorldY) || 0
    const hz = Number.parseFloat(hingeWorldZ) || 0
    const preset = {
      version: 1,
      overrides: {
        wheels: [...wheels],
        doors: [...doors],
        brakeLights: [...brakeLights],
      },
      wheelSpinLocalAxis,
      wheelSpinDefaultSign,
      doorRotationAxis,
      doorAdvanced: {
        defaults: {
          hingeMode,
          hingeWorld: [hx, hy, hz],
          openAngleDeg: Number.parseFloat(openAngleDeg) || 60,
          animSpeed: Number.parseFloat(doorAnimSpeed) || 3,
          rotationAxis: doorRotationAxis,
        },
        perDoor: sanitizePerDoor(perDoor),
      },
    }
    setPresetSaving(true)
    try {
      saveModelPreset(presetKey, preset)
      const serverOk = await persistModelPresetToServer(apiUrl, presetKey, preset, authFetch)
      if (!serverOk) console.warn('[preset] Server save failed; kept in this browser only.')
      onPresetSaved?.(preset)
      onClose()
    } finally {
      setPresetSaving(false)
    }
  }

  const handleClear = async () => {
    if (!presetKey || presetSaving) return
    setPresetSaving(true)
    try {
      clearModelPreset(presetKey)
      await persistModelPresetToServer(apiUrl, presetKey, null, authFetch)
      onPresetSaved?.(null)
      onClose()
    } finally {
      setPresetSaving(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Model mesh mapping"
    >
      <div
        className="max-h-[min(92dvh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-cyan-500/25 bg-[#0a0a14] p-4 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="font-orbitron text-sm font-bold uppercase tracking-widest text-cyan-300">
              Model settings
            </h2>
            <p className="mt-1 font-orbitron text-[9px] text-cyan-800">
              {vehicle?.name ?? 'Vehicle'} — mesh maps save to the API (shared +{' '}
              <code className="text-cyan-700">backend/data/model-presets.json</code>
              ) and cache in this browser if offline.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-gray-700 px-2 py-1 font-orbitron text-[10px] text-gray-400"
          >
            Close
          </button>
        </div>

        {!sceneInventory?.nodeNames?.length && (
          <p className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 font-orbitron text-[9px] text-amber-200/90">
            Scene node list is still loading. You can type names manually, or wait a moment and reopen.
          </p>
        )}

        <Section title="Wheels (spin)">
          <NamePicker
            label="Wheel assembly node names"
            nodeNames={nodeNames}
            selected={wheels}
            onChange={setWheels}
            help="Pick parent nodes that should spin together (rim+tire), not single lug meshes."
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-orbitron text-[9px] text-gray-500">Spin local axis</span>
            <select
              value={wheelSpinLocalAxis}
              onChange={(e) => setWheelSpinLocalAxis(e.target.value)}
              className="rounded border border-gray-700 bg-black/60 px-2 py-1 font-orbitron text-[9px] text-cyan-200"
            >
              {AXIS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="font-orbitron text-[9px] text-gray-500">Roll sign</span>
            <select
              value={wheelSpinDefaultSign}
              onChange={(e) => setWheelSpinDefaultSign(Number(e.target.value))}
              className="rounded border border-gray-700 bg-black/60 px-2 py-1 font-orbitron text-[9px] text-cyan-200"
            >
              <option value={-1}>-1 (default)</option>
              <option value={1}>+1</option>
            </select>
          </div>
        </Section>

        <Section title="Brake lights">
          <NamePicker
            label="Meshes or groups (groups expand to child meshes)"
            nodeNames={nodeNames}
            selected={brakeLights}
            onChange={setBrakeLights}
            help="Use exact names from the GLB. Groups like lights_red will include all child meshes."
          />
        </Section>

        <Section title="Doors">
          <NamePicker
            label="Door node names"
            nodeNames={nodeNames}
            selected={doors}
            onChange={setDoors}
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="font-orbitron text-[9px] text-gray-500">Open rotation axis</span>
            <select
              value={doorRotationAxis}
              onChange={(e) => setDoorRotationAxis(e.target.value)}
              className="rounded border border-gray-700 bg-black/60 px-2 py-1 font-orbitron text-[9px] text-cyan-200"
            >
              {AXIS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          {onStartHingePick3D && (
            <button
              type="button"
              onClick={onStartHingePick3D}
              className="mt-3 w-full rounded border border-amber-500/45 bg-amber-500/10 py-2 font-orbitron text-[9px] uppercase tracking-widest text-amber-200/95"
            >
              Pick hinge in 3D…
            </button>
          )}
          <p className="mt-1.5 font-orbitron text-[8px] leading-relaxed text-cyan-900">
            Closes this panel, then click the hinge edge on a door. We detect which door you hit — each side gets its own pivot. If the click is not on a door, values go to the default hinge below. Esc or empty click cancels.
          </p>
          <button
            type="button"
            onClick={() => setAdvOpen((v) => !v)}
            className="mt-3 w-full rounded border border-cyan-500/25 py-2 font-orbitron text-[9px] uppercase tracking-widest text-cyan-600"
          >
            {advOpen ? 'Hide' : 'Show'} advanced door / hinge
          </button>
          {advOpen && (
            <div className="mt-3 space-y-2 rounded border border-cyan-500/15 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <span className="font-orbitron text-[9px] text-gray-400">Hinge</span>
                <select
                  value={hingeMode}
                  onChange={(e) => setHingeMode(e.target.value)}
                  className="rounded border border-gray-700 bg-black/60 px-2 py-1 font-orbitron text-[9px] text-cyan-200"
                >
                  <option value="auto">Auto (inner X edge)</option>
                  <option value="manualWorld">Manual (world XYZ)</option>
                </select>
              </div>
              {hingeMode === 'manualWorld' && (
                <div className="flex gap-2">
                  {[
                    [hingeWorldX, setHingeWorldX, 'X'],
                    [hingeWorldY, setHingeWorldY, 'Y'],
                    [hingeWorldZ, setHingeWorldZ, 'Z'],
                  ].map(([val, setVal, lab]) => (
                    <label key={lab} className="flex flex-1 flex-col gap-0.5">
                      <span className="font-orbitron text-[8px] text-gray-600">{lab}</span>
                      <input
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        className="rounded border border-gray-700 bg-black/50 px-1 py-1 font-orbitron text-[9px] text-cyan-200"
                      />
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-0.5">
                  <span className="font-orbitron text-[8px] text-gray-600">Open angle °</span>
                  <input
                    value={openAngleDeg}
                    onChange={(e) => setOpenAngleDeg(e.target.value)}
                    className="rounded border border-gray-700 bg-black/50 px-1 py-1 font-orbitron text-[9px] text-cyan-200"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-0.5">
                  <span className="font-orbitron text-[8px] text-gray-600">Anim speed</span>
                  <input
                    value={doorAnimSpeed}
                    onChange={(e) => setDoorAnimSpeed(e.target.value)}
                    className="rounded border border-gray-700 bg-black/50 px-1 py-1 font-orbitron text-[9px] text-cyan-200"
                  />
                </label>
              </div>
              <p className="font-orbitron text-[8px] leading-relaxed text-gray-600">
                Default hinge applies to every door unless you override it per door below.
              </p>

              {doors.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-cyan-500/10 pt-3">
                  <p className="font-orbitron text-[9px] uppercase tracking-[0.2em] text-cyan-600">
                    Per-door overrides
                  </p>
                  <p className="font-orbitron text-[8px] leading-relaxed text-gray-600">
                    Use when left and right hinges differ. Pick hinge in 3D on each door to fill its world pivot, or choose auto / manual here.
                  </p>
                  {doors.map((dn) => {
                    const kind = doorHingeKind(perDoor, dn)
                    const p = perDoor[dn] ?? {}
                    const hw = Array.isArray(p.hingeWorld) ? p.hingeWorld : [0, 0, 0]
                    return (
                      <div
                        key={dn}
                        className="rounded border border-gray-800/90 bg-black/35 p-2"
                      >
                        <p className="mb-1.5 font-orbitron text-[9px] text-cyan-500">{dn}</p>
                        <select
                          className="mb-2 w-full rounded border border-gray-700 bg-black/60 px-2 py-1 font-orbitron text-[9px] text-cyan-200"
                          value={kind}
                          onChange={(e) => {
                            const v = e.target.value
                            setPerDoor((prev) => {
                              const next = { ...prev }
                              if (v === 'useDefault') {
                                delete next[dn]
                                return next
                              }
                              const cur = { ...(next[dn] ?? {}) }
                              cur.hingeMode = v === 'manualWorld' ? 'manualWorld' : 'auto'
                              if (v === 'auto') {
                                delete cur.hingeWorld
                              } else {
                                cur.hingeWorld = cur.hingeWorld ?? [0, 0, 0]
                              }
                              next[dn] = cur
                              return next
                            })
                          }}
                        >
                          <option value="useDefault">Hinge: use default (above)</option>
                          <option value="auto">Own pivot — auto (inner X)</option>
                          <option value="manualWorld">Own pivot — manual XYZ</option>
                        </select>
                        {kind === 'manualWorld' && (
                          <div className="flex gap-1.5">
                            {[
                              [0, 'X'],
                              [1, 'Y'],
                              [2, 'Z'],
                            ].map(([i, lab]) => (
                              <label key={lab} className="flex flex-1 flex-col gap-0.5">
                                <span className="font-orbitron text-[8px] text-gray-600">{lab}</span>
                                <input
                                  value={String(hw[i] ?? 0)}
                                  onChange={(e) => {
                                    const t = Number.parseFloat(e.target.value) || 0
                                    setPerDoor((prev) => {
                                      const next = { ...prev }
                                      const cur = { ...(next[dn] ?? {}) }
                                      const w = Array.isArray(cur.hingeWorld) ? [...cur.hingeWorld] : [0, 0, 0]
                                      w[i] = t
                                      next[dn] = { ...cur, hingeMode: 'manualWorld', hingeWorld: w }
                                      return next
                                    })
                                  }}
                                  className="rounded border border-gray-700 bg-black/50 px-1 py-1 font-orbitron text-[9px] text-cyan-200"
                                />
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-orbitron text-[8px] text-gray-500">Open axis</span>
                          <select
                            value={p.rotationAxis ?? ''}
                            onChange={(e) => {
                              const val = e.target.value
                              setPerDoor((prev) => {
                                const next = { ...prev }
                                const cur = { ...(next[dn] ?? {}) }
                                if (!val) delete cur.rotationAxis
                                else cur.rotationAxis = val
                                if (
                                  !cur.hingeMode &&
                                  !cur.hingeWorld &&
                                  cur.rotationAxis === undefined &&
                                  cur.openSign === undefined
                                ) {
                                  delete next[dn]
                                } else {
                                  next[dn] = cur
                                }
                                return next
                              })
                            }}
                            className="rounded border border-gray-700 bg-black/60 px-1 py-0.5 font-orbitron text-[8px] text-cyan-200"
                          >
                            <option value="">Default</option>
                            {AXIS.map((a) => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                          <span className="font-orbitron text-[8px] text-gray-500">Swing ±</span>
                          <select
                            value={p.openSign === undefined ? '' : String(p.openSign)}
                            onChange={(e) => {
                              const val = e.target.value
                              setPerDoor((prev) => {
                                const next = { ...prev }
                                const cur = { ...(next[dn] ?? {}) }
                                if (!val) delete cur.openSign
                                else cur.openSign = Number(val)
                                if (
                                  !cur.hingeMode &&
                                  !cur.hingeWorld &&
                                  cur.rotationAxis === undefined &&
                                  cur.openSign === undefined
                                ) {
                                  delete next[dn]
                                } else {
                                  next[dn] = cur
                                }
                                return next
                              })
                            }}
                            className="rounded border border-gray-700 bg-black/60 px-1 py-0.5 font-orbitron text-[8px] text-cyan-200"
                          >
                            <option value="">Auto</option>
                            <option value="-1">−1</option>
                            <option value="1">+1</option>
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </Section>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={presetSaving}
            onClick={handleSave}
            className="flex-1 rounded border border-cyan-500/60 bg-cyan-500/15 py-2.5 font-orbitron text-[10px] font-bold uppercase tracking-widest text-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {presetSaving ? 'Saving…' : 'Save for this model'}
          </button>
          <button
            type="button"
            disabled={presetSaving}
            onClick={handleClear}
            className="rounded border border-red-500/40 px-3 py-2 font-orbitron text-[9px] uppercase tracking-widest text-red-400/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear saved
          </button>
        </div>

        {sceneInventory?.matches && (
          <p className="mt-3 font-orbitron text-[8px] text-gray-600">
            Last match: wheels {sceneInventory.matches.wheels?.length ?? 0}, doors{' '}
            {sceneInventory.matches.doors?.length ?? 0}, brake lights{' '}
            {sceneInventory.matches.brakeLights?.length ?? 0}
          </p>
        )}
      </div>
    </div>
  )
}
