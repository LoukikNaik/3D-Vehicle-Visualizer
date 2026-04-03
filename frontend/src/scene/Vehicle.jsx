import { useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MESH_CONFIG } from './meshConfig'
import { ALL_MODEL_PATHS } from '../vehicles'
import { buildPartInfo, findInteractiveRoot } from './partInspect'

const _axisWorld = new THREE.Vector3()
const _localSpinAxis = new THREE.Vector3()
const _qParent = new THREE.Quaternion()
const _qInvParent = new THREE.Quaternion()
const _qWorld = new THREE.Quaternion()
const _qAlign = new THREE.Quaternion()
const _vAxleW = new THREE.Vector3()
const _vHubTargetW = new THREE.Vector3()
const _spinQuat = new THREE.Quaternion()

/** Unit vector in model bind pose: which local axis the wheel spins around. */
function setLocalSpinAxis(vector, axisKey) {
  const k = (axisKey || 'x').toLowerCase()
  const x = k === 'x' ? 1 : 0
  const y = k === 'y' ? 1 : 0
  const z = k === 'z' ? 1 : 0
  vector.set(x, y, z)
}

// ---------------------------------------------------------------------------
// Mesh detection
// ---------------------------------------------------------------------------

function getNodeDepth(node) {
  let depth = 0; let cur = node.parent
  while (cur) { depth++; cur = cur.parent }
  return depth
}

/**
 * Detect interactive meshes in the scene.
 * vehicleOverrides — per-vehicle exact node/mesh names (from vehicles.js)
 * Falls back to global pattern matching for unknown/uploaded models.
 */
function detectMeshes(scene, vehicleOverrides = {}) {
  const found = { wheels: [], doors: [], brakeLights: [] }

  // Log full hierarchy for debugging
  console.group('[Vehicle] Mesh hierarchy')
  scene.traverse((node) => {
    if (node.isMesh || node.isGroup) {
      const indent = '  '.repeat(Math.min(getNodeDepth(node), 7))
      console.log(`${indent}${node.isMesh ? '●' : '○'} "${node.name}"`)
    }
  })
  console.groupEnd()

  scene.traverse((node) => {
    const name = node.name
    if (!name) return

    // ── Wheels: when overrides exist, ONLY match overrides (skip patterns to
    //    avoid matching renamed child meshes like "wheel_1", "wheel_2") ──────
    const hasExplicitWheels = vehicleOverrides.wheels?.length > 0
    if (hasExplicitWheels) {
      if (vehicleOverrides.wheels.includes(name)) found.wheels.push(node)
    } else {
      const wPatterns = MESH_CONFIG.wheels.patterns
      if (wPatterns.some(p => p.test(name))) found.wheels.push(node)
    }

    // ── Doors: when overrides exist, ONLY match overrides (skip patterns to
    //    avoid double-matching child meshes like "Left Door_Material.003_0") ──
    const hasExplicitDoors = vehicleOverrides.doors?.length > 0
    if (hasExplicitDoors) {
      if (vehicleOverrides.doors.includes(name)) found.doors.push(node)
    } else if (node.isMesh && MESH_CONFIG.doors.patterns.some(p => p.test(name))) {
      found.doors.push(node)
    }

    // ── Brake lights — need Mesh materials (emissive). Explicit names may be
    //    Groups in GLB (e.g. Ferrari lights_red); collect descendant meshes.
    const hasExplicitBL = vehicleOverrides.brakeLights?.length > 0
    if (hasExplicitBL && vehicleOverrides.brakeLights.includes(name)) {
      if (node.isMesh) {
        found.brakeLights.push(node)
      } else {
        node.traverse((ch) => {
          if (ch.isMesh) found.brakeLights.push(ch)
        })
      }
    } else if (!hasExplicitBL && node.isMesh && MESH_CONFIG.brakeLights.patterns.some(p => p.test(name))) {
      found.brakeLights.push(node)
    }
  })

  const blSeen = new Set()
  found.brakeLights = found.brakeLights.filter((m) => {
    if (blSeen.has(m.uuid)) return false
    blSeen.add(m.uuid)
    return true
  })

  // Log matches
  console.group('[Vehicle] Matched nodes')
  for (const [cat, nodes] of Object.entries(found)) {
    if (nodes.length) console.log(`  ✓ ${cat}:`, nodes.map(n => `"${n.name}"`).join(', '))
    else              console.warn(`  ✗ ${cat}: no matches`)
  }
  console.groupEnd()

  return found
}

function collectSceneNodeNames(scene) {
  const names = new Set()
  scene.traverse((node) => {
    if (node.name) names.add(node.name)
  })
  return [...names].sort()
}

// ---------------------------------------------------------------------------
// Pivot fix — for models with baked geometry (all nodes at origin)
// ---------------------------------------------------------------------------

/**
 * Compute the bounding-box center of a node's descendant meshes.
 * Returns null if no meshes found.
 */
function getGeometryCenter(node) {
  const box = new THREE.Box3()
  let hasMesh = false
  node.traverse(child => {
    if (child.isMesh && child.geometry) {
      child.geometry.computeBoundingBox()
      const meshBox = child.geometry.boundingBox.clone()
      meshBox.applyMatrix4(child.matrixWorld)
      box.union(meshBox)
      hasMesh = true
    }
  })
  if (!hasMesh) return null
  return box.getCenter(new THREE.Vector3())
}

/**
 * Fix pivot for nodes that sit at the origin but have offset geometry.
 * Moves the node's position to the geometry center so rotation works
 * around the correct point, then offsets children to compensate.
 *
 * pivotPoint is in **world** space (from bounding boxes with matrixWorld).
 * Never assign world coords directly to node.position (local).
 */
function fixPivot(node, pivotPoint, { force = false } = {}) {
  // Skip if the GLB already placed this node off-origin — unless `force` (doors need
  // hinge relocation even when Sketchfab baked a non-zero group position).
  if (!force && node.position.length() > 0.01) return
  if (!pivotPoint) return

  node.updateMatrixWorld(true)
  const originWorld = new THREE.Vector3()
  node.getWorldPosition(originWorld)
  if (originWorld.distanceToSquared(pivotPoint) < 1e-4) return

  if (!node.parent) {
    node.position.copy(pivotPoint)
    node.children.forEach((child) => child.position.sub(pivotPoint))
    return
  }

  const pivotInNodeLocal = new THREE.Vector3()
  pivotInNodeLocal.copy(pivotPoint)
  node.worldToLocal(pivotInNodeLocal)

  const posInParent = new THREE.Vector3()
  posInParent.copy(pivotPoint)
  node.parent.worldToLocal(posInParent)

  node.position.copy(posInParent)
  node.children.forEach((child) => child.position.sub(pivotInNodeLocal))

  if (node.isMesh && node.geometry) {
    node.geometry.translate(-pivotInNodeLocal.x, -pivotInNodeLocal.y, -pivotInNodeLocal.z)
    node.geometry.computeBoundingBox()
  }
}

/**
 * Rotate the wheel so its local +X (hub / axle) aligns with a world-space direction.
 * Some GLBs bake steering into the front wheels; this neutralizes it for a straight pose.
 */
function alignWheelHubAxleToWorld(wheel, targetX, targetY, targetZ) {
  if (!wheel.parent) return
  _vHubTargetW.set(targetX, targetY, targetZ).normalize()
  wheel.parent.updateMatrixWorld(true)
  wheel.parent.getWorldQuaternion(_qParent)
  wheel.getWorldQuaternion(_qWorld)
  _vAxleW.set(1, 0, 0).applyQuaternion(_qWorld).normalize()
  if (1 - Math.abs(_vAxleW.dot(_vHubTargetW)) < 1e-4) return
  _qAlign.setFromUnitVectors(_vAxleW, _vHubTargetW)
  _qWorld.premultiply(_qAlign)
  _qInvParent.copy(_qParent).invert().multiply(_qWorld)
  wheel.quaternion.copy(_qInvParent)
}

/**
 * For doors, compute hinge point at inner X-edge of bounding box.
 */
function getDoorHinge(node) {
  const box = new THREE.Box3()
  let hasMesh = false
  node.traverse(child => {
    if (child.isMesh && child.geometry) {
      child.geometry.computeBoundingBox()
      const meshBox = child.geometry.boundingBox.clone()
      meshBox.applyMatrix4(child.matrixWorld)
      box.union(meshBox)
      hasMesh = true
    }
  })
  if (!hasMesh) return null
  const center = box.getCenter(new THREE.Vector3())
  // Hinge at the inner X-edge (closest to car centerline X=0)
  const hingeX = center.x > 0 ? box.min.x : box.max.x
  return new THREE.Vector3(hingeX, center.y, center.z)
}

// ---------------------------------------------------------------------------
// Vehicle component
// ---------------------------------------------------------------------------

export function Vehicle({
  modelPath,
  vehicleOverrides,
  vehicleConfig,
  brakeLights,
  doorsOpen,
  speed,
  onSceneInventory,
  partPickEnabled,
  onPartPicked,
  hingePickEnabled,
  onHingeWorldPicked,
}) {
  const { scene } = useGLTF(modelPath)

  const meshesRef     = useRef({ wheels: [], doors: [], brakeLights: [] })
  const doorAngleRef  = useRef(0)
  const wheelAngleRef = useRef(0)
  const onInventoryRef = useRef(onSceneInventory)
  onInventoryRef.current = onSceneInventory
  const onPartPickedRef = useRef(onPartPicked)
  onPartPickedRef.current = onPartPicked
  const onHingeWorldPickedRef = useRef(onHingeWorldPicked)
  onHingeWorldPickedRef.current = onHingeWorldPicked

  const handleVehicleClick = (e) => {
    if (hingePickEnabled) {
      e.stopPropagation()
      const p = e.point
      if (p) {
        let doorName = null
        const obj = e.object
        if (obj?.isMesh) {
          const hit = findInteractiveRoot(obj, scene, meshesRef.current)
          if (hit?.role === 'door') doorName = hit.root.name ?? null
        }
        onHingeWorldPickedRef.current?.({ x: p.x, y: p.y, z: p.z, doorName })
      }
      return
    }
    if (!partPickEnabled) return
    e.stopPropagation()
    const obj = e.object
    if (!obj?.isMesh) return
    const info = buildPartInfo(obj, scene, meshesRef.current, vehicleConfig)
    onPartPickedRef.current?.(info)
  }

  // ── One-time setup on model load ─────────────────────────────────────────
  useEffect(() => {
    // Update world matrices before bounding box calculations
    scene.updateMatrixWorld(true)

    meshesRef.current = detectMeshes(scene, vehicleOverrides ?? {})

    const nodeNames = collectSceneNodeNames(scene)
    onInventoryRef.current?.({
      nodeNames,
      matches: {
        wheels: meshesRef.current.wheels.map((n) => n.name),
        doors: meshesRef.current.doors.map((n) => n.name),
        brakeLights: meshesRef.current.brakeLights.map((n) => n.name),
      },
    })

    // Fix pivots for nodes at origin with offset geometry (e.g. Sketchfab models).
    // Skip leaf Meshes: some GLTF wheels are Mesh under transformed parents and share
    // one BufferGeometry — geometry.translate() would corrupt every wheel using it.
    meshesRef.current.wheels.forEach(w => {
      if (w.isMesh && w.children.length === 0) return
      const center = getGeometryCenter(w)
      if (center) fixPivot(w, center)
    })
    meshesRef.current.doors.forEach((d) => {
      const da = vehicleConfig?.doorAdvanced
      const defs = da?.defaults ?? {}
      const per = da?.perDoor?.[d.name] ?? {}
      const mode = per.hingeMode ?? defs.hingeMode ?? 'auto'
      let hinge = null
      if (mode === 'manualWorld') {
        const hw = per.hingeWorld ?? defs.hingeWorld
        if (hw && hw.length === 3) hinge = new THREE.Vector3(hw[0], hw[1], hw[2])
      } else {
        hinge = getDoorHinge(d)
      }
      const hingeKey =
        mode === 'manualWorld' && hinge
          ? `mw:${hinge.x.toFixed(4)},${hinge.y.toFixed(4)},${hinge.z.toFixed(4)}`
          : hinge
            ? `auto:${hinge.x.toFixed(4)},${hinge.y.toFixed(4)},${hinge.z.toFixed(4)}`
            : 'none'
      if (d.userData._doorHingeKey !== hingeKey) {
        delete d.userData._doorRestEuler
        d.userData._doorHingeKey = hingeKey
      }
      // useGLTF caches scenes — a previous visit may have left doors rotated. Keep a permanent
      // bind euler on the node; restore it on remount instead of treating "current" rotation as base.
      if (!d.userData._doorRestEuler) {
        if (hinge) fixPivot(d, hinge, { force: true })
        d.userData._doorRestEuler = new THREE.Euler(d.rotation.x, d.rotation.y, d.rotation.z, d.rotation.order)
      } else {
        d.rotation.set(
          d.userData._doorRestEuler.x,
          d.userData._doorRestEuler.y,
          d.userData._doorRestEuler.z,
          d.userData._doorRestEuler.order,
        )
      }
      d.userData._doorBaseEuler = new THREE.Euler(
        d.userData._doorRestEuler.x,
        d.userData._doorRestEuler.y,
        d.userData._doorRestEuler.z,
        d.userData._doorRestEuler.order,
      )
    })

    const alignNames = vehicleConfig?.wheelsHubWorldAlign
    const alignDir = vehicleConfig?.wheelsHubWorldDir ?? [1, 0, 0]
    if (alignNames?.length) {
      meshesRef.current.wheels.forEach((w) => {
        if (alignNames.includes(w.name)) {
          alignWheelHubAxleToWorld(w, alignDir[0], alignDir[1], alignDir[2])
        }
      })
    }

    // Store base quaternion for each wheel (once per scene load) and reset drift
    meshesRef.current.wheels.forEach(w => {
      if (!w.userData._baseQuat) {
        w.userData._baseQuat = w.quaternion.clone()
      }
      w.quaternion.copy(w.userData._baseQuat)
    })
    wheelAngleRef.current = 0

    scene.traverse((node) => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true }
    })

    // Upgrade brake light materials to MeshStandardMaterial so emissive works.
    // Ferrari uses MeshBasicMaterial for lights — no emissive support without this.
    meshesRef.current.brakeLights.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mesh.material = (Array.isArray(mesh.material) ? mats.map(upgrade) : upgrade(mats[0]))
    })
  }, [scene, vehicleOverrides, vehicleConfig])

  // ── Brake lights emissive ─────────────────────────────────────────────────
  useEffect(() => {
    const { brakeLights: meshes } = meshesRef.current
    if (!meshes.length) return

    const { onColor, onIntensity } = MESH_CONFIG.brakeLights
    const color     = new THREE.Color(brakeLights ? onColor : '#000000')
    const intensity = brakeLights ? onIntensity : 0

    meshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach((mat) => {
        if (!mat) return
        mat.emissive.set(color)
        mat.emissiveIntensity = intensity
        mat.needsUpdate = true
      })
    })
  }, [brakeLights])

  // ── Per-frame: wheels + doors ─────────────────────────────────────────────
  useFrame((_, delta) => {
    const { wheels, doors } = meshesRef.current

    if (wheels.length) {
      if (speed > 0) wheelAngleRef.current += delta * speed * 0.05
      const signOverrides = vehicleConfig?.wheelSignOverrides ?? {}
      const defaultSpinSign = vehicleConfig?.wheelSpinDefaultSign ?? -1
      const axisKey =
        vehicleConfig?.wheelSpinLocalAxis ?? MESH_CONFIG.wheels.rotationAxis ?? 'x'
      setLocalSpinAxis(_localSpinAxis, axisKey)
      wheels.forEach(w => {
        const baseQuat = w.userData._baseQuat
        if (!baseQuat) return
        const sign = signOverrides[w.name] ?? defaultSpinSign
        _axisWorld.copy(_localSpinAxis).applyQuaternion(baseQuat)
        if (_axisWorld.lengthSq() < 1e-10) _axisWorld.set(1, 0, 0)
        else _axisWorld.normalize()
        _spinQuat.setFromAxisAngle(_axisWorld, sign * wheelAngleRef.current)
        w.quaternion.copy(_spinQuat).multiply(baseQuat)
      })
    }

    if (doors.length) {
      const da = vehicleConfig?.doorAdvanced
      const defs = da?.defaults ?? {}
      const openRad =
        defs.openAngleDeg != null
          ? THREE.MathUtils.degToRad(defs.openAngleDeg)
          : MESH_CONFIG.doors.openAngle
      const animSpeed = defs.animSpeed ?? MESH_CONFIG.doors.animSpeed
      const defaultAxis =
        defs.rotationAxis ??
        vehicleConfig?.doorRotationAxis ??
        MESH_CONFIG.doors.rotationAxis
      const target = doorsOpen ? openRad : 0
      doorAngleRef.current = THREE.MathUtils.lerp(doorAngleRef.current, target, delta * animSpeed)
      doors.forEach((d) => {
        const per = da?.perDoor?.[d.name] ?? {}
        const axis = per.rotationAxis ?? defaultAxis
        const sign =
          per.openSign != null ? per.openSign : d.position.x >= 0 ? -1 : 1
        const b = d.userData._doorBaseEuler
        const rel = sign * doorAngleRef.current
        if (b) {
          d.rotation.set(b.x, b.y, b.z, b.order)
          d.rotation[axis] = b[axis] + rel
        } else {
          d.rotation[axis] = rel
        }
      })
    }
  })

  return (
    <>
      <primitive object={scene} dispose={null} onClick={handleVehicleClick} />
      <pointLight
        position={[0, 0.5, 2.2]}
        color="#ff1500"
        intensity={brakeLights ? 8 : 0}
        distance={4}
        decay={2}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Material upgrade helper
// ---------------------------------------------------------------------------

function upgrade(mat) {
  if (!mat) return mat
  if (mat.type === 'MeshStandardMaterial' || mat.type === 'MeshPhysicalMaterial') return mat.clone()
  const std = new THREE.MeshStandardMaterial({
    color:             mat.color?.clone() ?? new THREE.Color('#ff0000'),
    map:               mat.map  ?? null,
    roughness:         0.3,
    metalness:         0.1,
    emissive:          new THREE.Color('#000000'),
    emissiveIntensity: 0
  })
  mat.dispose()
  return std
}

// Preload all built-in models so switching is instant
ALL_MODEL_PATHS.forEach(p => useGLTF.preload(p))
