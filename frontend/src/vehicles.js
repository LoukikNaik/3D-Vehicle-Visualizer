export const VEHICLES = [
  {
    id: 'ferrari',
    name: 'Ferrari F40',
    label: 'SUPERCAR · 1992',
    path: '/models/ferrari.glb',
    color: '#ff2200',
    overrides: {
      wheels:      ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
      // lights_red is a Group — Vehicle collects child meshes. Glass + front LED for full coverage.
      brakeLights: ['lights_red', 'Taillight_Glass', 'Turn_Signal_LED'],
      doors:       []
    }
  },
  {
    id: 'car-concept',
    name: 'Concept GT',
    label: 'CONCEPT · PBR',
    path: '/models/car_concept.glb',
    color: '#00ccff',
    // GLB bakes ~30° steer on front wheels; align hub +X to world +X like the rears.
    wheelsHubWorldAlign: ['WheelFrontL', 'WheelFrontR'],
    wheelsHubWorldDir: [1, 0, 0],
    // Hub fix inverts effective roll vs default -1; +1 rolls forward with positive speed.
    wheelSpinDefaultSign: 1,
    // BodyUnderside applies -90° X; door local Y → world −Z. Use local Z (≈ world up) as hinge.
    doorRotationAxis: 'z',
    // Roof uses a different swing axis than the side doors; preset merges over this in modelPresetStorage.
    doorAdvanced: {
      perDoor: {
        BodyRoofPanel: {
          rotationAxis: 'x',
          openSign: 1,
        },
      },
    },
    overrides: {
      wheels:      ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'],
      brakeLights: ['BodyTaillights'],
      doors:       ['BodyDoorRColor1', 'BodyDoorLColor1', 'BodyRoofPanel'],
    }
  },
  {
    id: '3d-truck',
    name: '3D Truck',
    label: 'TRUCK · SKETCHFAB',
    path: '/models/3d_truck__model.glb',
    color: '#ff6600',
    // Wheel local Z aligns with world ±X (axle); local X is wrong for roll.
    wheelSpinLocalAxis: 'z',
    overrides: {
      wheels:      ['Back_wheel', 'frontwheel'],
      brakeLights: ['down_light_0'],
      doors:       ['Left Door', 'Right Door']
    }
  }
]

export const ALL_MODEL_PATHS = VEHICLES.map(v => v.path)
