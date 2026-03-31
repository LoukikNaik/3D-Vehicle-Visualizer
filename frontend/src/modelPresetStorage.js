const STORAGE_PREFIX = 'vehicle-viz:preset:'

/**
 * Stable key for localStorage: built-ins by id, uploads by file name + size.
 */
export function getModelPresetKey(vehicle) {
  if (!vehicle) return null
  if (vehicle.id === 'custom') {
    const m = vehicle._uploadMeta
    const name = (m?.name || 'upload').replace(/[^a-z0-9_-]/gi, '_')
    return `custom:${name}:${m?.size ?? 0}`
  }
  return `builtin:${vehicle.id}`
}

export function loadModelPreset(key) {
  if (!key || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveModelPreset(key, preset) {
  if (!key || typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(preset))
}

export function clearModelPreset(key) {
  if (!key || typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_PREFIX + key)
}

/**
 * Fetch all mesh presets from the API (key → preset object).
 * Returns null if the request failed (caller may keep local-only data).
 */
/**
 * @param {typeof fetch} [httpFetch] injected auth-aware fetch (default global fetch)
 */
export async function fetchModelPresetsMap(apiUrl, httpFetch = fetch) {
  if (!apiUrl) return null
  try {
    const res = await httpFetch(`${apiUrl}/vehicle/presets`)
    if (!res.ok) return null
    const data = await res.json()
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null
  } catch {
    return null
  }
}

/**
 * Upsert or delete a preset on the server. Still mirror to localStorage when preset is non-null.
 */
export async function persistModelPresetToServer(apiUrl, key, preset, httpFetch = fetch) {
  if (!apiUrl) return false
  try {
    const res = await httpFetch(`${apiUrl}/vehicle/preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, preset }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Layer preset door tuning on top of vehicle defaults (e.g. GT roof panel vs doors). */
function mergeDoorAdvanced(vehicleDa, presetDa) {
  if (!presetDa) return vehicleDa
  if (!vehicleDa) return presetDa
  return {
    defaults: { ...(vehicleDa.defaults ?? {}), ...(presetDa.defaults ?? {}) },
    perDoor: { ...(vehicleDa.perDoor ?? {}), ...(presetDa.perDoor ?? {}) },
  }
}

/**
 * Merge saved user preset onto vehicle (overrides, door/wheel options).
 */
export function applyUserPreset(vehicle, preset) {
  if (!vehicle || !preset) return vehicle
  const o = vehicle.overrides ?? {}
  const po = preset.overrides ?? {}
  return {
    ...vehicle,
    overrides: {
      wheels: Array.isArray(po.wheels) && po.wheels.length > 0 ? [...po.wheels] : [...(o.wheels ?? [])],
      doors: Array.isArray(po.doors) && po.doors.length > 0 ? [...po.doors] : [...(o.doors ?? [])],
      brakeLights:
        Array.isArray(po.brakeLights) && po.brakeLights.length > 0
          ? [...po.brakeLights]
          : [...(o.brakeLights ?? [])],
    },
    doorRotationAxis: preset.doorRotationAxis ?? vehicle.doorRotationAxis,
    wheelSpinLocalAxis: preset.wheelSpinLocalAxis ?? vehicle.wheelSpinLocalAxis,
    wheelSpinDefaultSign: preset.wheelSpinDefaultSign ?? vehicle.wheelSpinDefaultSign,
    doorAdvanced: mergeDoorAdvanced(vehicle.doorAdvanced, preset.doorAdvanced),
  }
}
