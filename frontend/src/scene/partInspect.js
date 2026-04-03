import * as THREE from 'three'
import { MESH_CONFIG } from './meshConfig'

/**
 * Walk parents from the hit mesh to find a registered interactive root (wheel / door),
 * or match brake meshes by walking up (brake list stores meshes only).
 */
export function findInteractiveRoot(mesh, scene, found) {
  const { wheels, doors, brakeLights } = found
  let o = mesh
  while (o && o !== scene) {
    if (wheels.some((w) => w.uuid === o.uuid)) return { role: 'wheel', root: o }
    if (doors.some((d) => d.uuid === o.uuid)) return { role: 'door', root: o }
    if (brakeLights.some((b) => b.uuid === o.uuid)) return { role: 'brakeLight', root: o }
    o = o.parent
  }
  return null
}

/**
 * Build a serializable description for the UI when the user picks a mesh.
 */
export function buildPartInfo(mesh, scene, found, vehicleConfig) {
  const hitName = mesh.name?.trim() || '(unnamed mesh)'
  const root = findInteractiveRoot(mesh, scene, found)

  if (!root) {
    return {
      role: 'other',
      hitName,
      rootName: null,
      title: 'Static geometry',
      bullets: [
        'Not mapped as a wheel, door, or brake light.',
        'Open Model settings… to assign this node if it should move or glow with the API.',
      ],
    }
  }

  const rootName = root.root.name?.trim() || '(unnamed node)'

  if (root.role === 'wheel') {
    const axis =
      vehicleConfig?.wheelSpinLocalAxis ?? MESH_CONFIG.wheels.rotationAxis ?? 'x'
    const sign = vehicleConfig?.wheelSpinDefaultSign ?? -1
    const bullets = [
      'Linked to Speed: rotates continuously while speed > 0 (vehicle control / API).',
      `Spin is around local ${String(axis).toUpperCase()}.`,
      `Roll sign is ${sign} — change in Model settings if it rolls backward.`,
    ]
    const align = vehicleConfig?.wheelsHubWorldAlign
    if (align?.length) {
      bullets.push(
        `Hub realign applies to: ${align.join(', ')} (world dir ${(vehicleConfig?.wheelsHubWorldDir ?? [1, 0, 0]).join(', ')}).`,
      )
    }
    return {
      role: 'wheel',
      hitName,
      rootName,
      title: `Wheel — ${rootName}`,
      bullets,
    }
  }

  if (root.role === 'door') {
    const da = vehicleConfig?.doorAdvanced?.defaults ?? {}
    const per = vehicleConfig?.doorAdvanced?.perDoor?.[rootName] ?? {}
    const axis =
      per.rotationAxis ??
      da.rotationAxis ??
      vehicleConfig?.doorRotationAxis ??
      MESH_CONFIG.doors.rotationAxis
    const openDeg =
      da.openAngleDeg != null
        ? da.openAngleDeg
        : Math.round(THREE.MathUtils.radToDeg(MESH_CONFIG.doors.openAngle))
    const hingeMode = per.hingeMode ?? da.hingeMode ?? 'auto'
    const hingeLabel =
      hingeMode === 'manualWorld'
        ? `Manual hinge in world space (${(per.hingeWorld ?? da.hingeWorld ?? [0, 0, 0]).join(', ')})`
        : 'Auto hinge (inner X edge from bounds)'
    const anim = per.animSpeed ?? da.animSpeed ?? MESH_CONFIG.doors.animSpeed

    return {
      role: 'door',
      hitName,
      rootName,
      title: `Door — ${rootName}`,
      bullets: [
        'Linked to Doors toggle: swings open/closed with easing.',
        `Opens around local ${String(axis).toUpperCase()} (~${openDeg}° target).`,
        hingeLabel + '.',
        `Animation smoothing: ${anim} (higher = snappier).`,
      ],
    }
  }

  /* brakeLight */
  return {
    role: 'brakeLight',
    hitName,
    rootName,
    title: rootName !== hitName ? `Brake light — ${rootName}` : `Brake light — ${hitName}`,
    bullets: [
      'Linked to Brake lights toggle: emissive color + bloom when on.',
      `When on: tint ${MESH_CONFIG.brakeLights.onColor}, emissive intensity ${MESH_CONFIG.brakeLights.onIntensity}.`,
      ...(hitName !== rootName ? [`Sub-mesh hit: “${hitName}”.`] : []),
    ],
  }
}
