import { useRef, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Html, useProgress } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Suspense } from 'react'
import { Vehicle } from './Vehicle'

// ---------------------------------------------------------------------------
// Loading overlay (shown while GLB fetches)
// ---------------------------------------------------------------------------

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div style={{ fontFamily: 'Orbitron, monospace', textAlign: 'center' }}>
        <p style={{ color: '#22d3ee', fontSize: 12, letterSpacing: '0.3em' }}>
          LOADING VEHICLE
        </p>
        <p style={{ color: '#164e63', fontSize: 11, marginTop: 6, letterSpacing: '0.2em' }}>
          {progress.toFixed(0)}%
        </p>
      </div>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Camera preset controller — lives inside Canvas to access useThree
// ---------------------------------------------------------------------------

const CAMERA_PRESETS = {
  front:   { pos: [0,   1.5, -6.5], target: [0, 0.5, 0] },  // -Z = front of car
  side:    { pos: [6,   1.5,  0],   target: [0, 0.5, 0] },  // +X = right side
  top:     { pos: [0,  10,    0.01],target: [0, 0,   0] },
  default: { pos: [3,  2,    -5],   target: [0, 0.5, 0] }   // front-right quarter
}

function CameraController({ preset, controlsRef }) {
  const { camera } = useThree()

  useEffect(() => {
    if (!preset || !controlsRef.current) return

    const { pos, target } = CAMERA_PRESETS[preset] ?? CAMERA_PRESETS.default
    camera.position.set(...pos)
    camera.lookAt(...target)
    controlsRef.current.target.set(...target)
    controlsRef.current.update()
  }, [preset]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export function Scene({
  vehicleState,
  cameraPreset,
  modelPath,
  vehicleOverrides,
  vehicleConfig,
  onSceneInventory,
  partPickEnabled,
  onPartPicked,
  onPickMissed,
  hingePickEnabled,
  onHingeWorldPicked,
}) {
  const pickOrHinge = partPickEnabled || hingePickEnabled
  const controlsRef = useRef()

  return (
    <Canvas
      shadows
      camera={{ position: [3, 2, -5], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      style={{
        width: '100%',
        height: '100%',
        cursor: pickOrHinge ? 'crosshair' : undefined,
      }}
      onPointerMissed={onPickMissed}
    >
      {/* Base fill light — keeps dark areas from going pure black */}
      <ambientLight intensity={0.15} />

      {/* Primary directional light with shadow map */}
      <directionalLight
        position={[6, 10, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      {/* HDRI environment — "city" preset, no file required */}
      <Environment preset="city" />

      {/* Soft ground shadow blob */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.75}
        scale={14}
        blur={2.5}
        far={5}
        color="#000011"
      />

      {/* Vehicle — key forces full remount when model path changes */}
      <Suspense fallback={<Loader />}>
        <Vehicle
          key={modelPath}
          modelPath={modelPath}
          vehicleOverrides={vehicleOverrides}
          vehicleConfig={vehicleConfig}
          brakeLights={vehicleState.brakeLights}
          doorsOpen={vehicleState.doorsOpen}
          speed={vehicleState.speed}
          onSceneInventory={onSceneInventory}
          partPickEnabled={partPickEnabled}
          onPartPicked={onPartPicked}
          hingePickEnabled={hingePickEnabled}
          onHingeWorldPicked={onHingeWorldPicked}
        />
      </Suspense>

      {/* Orbit controls with damping */}
      <OrbitControls
        ref={controlsRef}
        target={[0, 0.5, 0]}
        enablePan={!pickOrHinge}
        enableZoom
        enableRotate={!pickOrHinge}
        enableDamping
        dampingFactor={0.05}
        minDistance={2}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.1}
      />

      {/* Camera preset jumps — handled inside Canvas to access useThree */}
      <CameraController preset={cameraPreset} controlsRef={controlsRef} />

      {/* Bloom postprocessing — makes emissive brake lights glow */}
      <EffectComposer>
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}
