/**
 * meshConfig.js
 *
 * Controls how the app auto-detects interactive meshes in your GLB model.
 *
 * ── HOW TO USE ──────────────────────────────────────────────────────────────
 * 1. Drop your car.glb into frontend/public/
 * 2. Run the app — open browser DevTools → Console
 * 3. Look for "[Vehicle] Full mesh hierarchy" — every mesh name is logged
 * 4. If a category shows "NO MATCHES", copy the exact mesh name(s) into
 *    that category's `overrides` array below.
 *
 * Example:
 *   wheels.overrides: ['Mesh_047', 'Object_12']
 * ────────────────────────────────────────────────────────────────────────────
 */

export const MESH_CONFIG = {
  wheels: {
    // Match wheel ASSEMBLY nodes (e.g. wheel_fl) — rotating the parent node
    // spins the entire assembly (rim + tire + brake + nuts) as one unit.
    // Deliberately avoids bare "wheel" / "tire" / "rim" mesh names to prevent
    // rotating individual parts from their own off-center pivots.
    patterns: [
      /^wheel_/i,   // wheel_fl, wheel_fr, wheel_rl, wheel_rr
      /^roue_/i,    // French
      /^rueda_/i,   // Spanish
      /^reifen_/i   // German
    ],
    // Fallback: add exact assembly node names here if auto-match misses them
    overrides: [],
    // Exact mesh name overrides — add names from console log if needed
    overrides: [],
    // Which axis to rotate on — 'x' works for most western-modeled cars,
    // change to 'z' if wheels spin sideways
    rotationAxis: 'x',
    // Rotation speed in radians/second
    rotationSpeed: 3.0
  },

  doors: {
    patterns: [
      /door/i,
      /portiere/i,  // Italian
      /porte/i,     // French
      /puerta/i,    // Spanish
      /tuer/i       // German
    ],
    overrides: [],
    // Open angle in radians (Math.PI / 3 ≈ 60°)
    openAngle: Math.PI / 3,
    // Lerp speed toward open/close target
    animSpeed: 3.0,
    // Standard doors rotate on Y axis when opening
    rotationAxis: 'y'
  },

  brakeLights: {
    patterns: [
      /tail.?light/i,
      /taillight/i,
      /rear.?light/i,
      /rearlamp/i,
      /back.?light/i,
      /stop.?light/i,
      /lights.?red/i,   // e.g. "lights_red" (Ferrari-style naming)
      /red.?light/i,    // e.g. "red_lights"
      /feu.?arri/i      // French: "feu arrière"
    ],
    overrides: [],
    // Emissive color when ON — deep red
    onColor: '#ff1500',
    // Emissive intensity when ON (higher = brighter glow with bloom)
    onIntensity: 5.0
  }
}
