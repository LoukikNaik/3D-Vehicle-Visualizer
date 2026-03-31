import { useRef } from 'react'

export function VehicleSelector({ vehicles, selectedId, onSelect, onUpload }) {
  const fileInputRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    onUpload({
      url,
      name: file.name.replace(/\.(glb|gltf)$/i, ''),
      uploadMeta: { name: file.name, size: file.size },
    })
    e.target.value = ''
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-30 sm:absolute sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2"
    >
      <div
        className="vehicle-strip flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto overflow-y-visible py-1 [overscroll-behavior-x:contain] sm:justify-center sm:overflow-x-visible sm:py-0"
      >
        {vehicles.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            active={selectedId === v.id}
            onClick={() => onSelect(v)}
          />
        ))}

        <div
          className="hidden w-px shrink-0 self-stretch bg-cyan-500/20 sm:mx-1 sm:block sm:h-10 sm:self-center"
          aria-hidden
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-[64px] min-w-[84px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg border px-2.5 py-2 backdrop-blur-md transition-all duration-200 sm:min-h-0 sm:min-w-[80px] sm:px-4 sm:py-2.5
            ${selectedId === 'custom'
              ? 'border-purple-500/70 bg-purple-500/10 shadow-[0_0_14px_rgba(168,85,247,0.2)]'
              : 'border-gray-700/50 bg-black/40 hover:border-gray-500/70'
            }`}
        >
          <span className="text-lg leading-none">
            {selectedId === 'custom' ? '✦' : '+'}
          </span>
          <span className="font-orbitron text-[9px] uppercase tracking-widest text-gray-500">
            Upload GLB
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          className="hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  )
}

function VehicleCard({ vehicle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[64px] min-w-[84px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg border px-2.5 py-2 backdrop-blur-md transition-all duration-200 active:opacity-90 sm:min-h-0 sm:min-w-[80px] sm:px-3 sm:py-2.5
        ${active
          ? 'border-opacity-70 bg-opacity-10'
          : 'border-gray-700/50 bg-black/40 hover:border-gray-500/70'
        }`}
      style={
        active
          ? {
              borderColor: vehicle.color,
              backgroundColor: `${vehicle.color}18`,
              boxShadow: `0 0 14px ${vehicle.color}30`
            }
          : undefined
      }
    >
      <div
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: active ? vehicle.color : '#374151',
          boxShadow: active ? `0 0 6px ${vehicle.color}` : 'none'
        }}
      />

      <span
        className="max-w-[5.5rem] truncate text-center font-orbitron text-[10px] font-bold tracking-wider sm:max-w-none sm:whitespace-nowrap"
        style={{ color: active ? vehicle.color : '#6b7280' }}
      >
        {vehicle.name}
      </span>

      <span
        className="hidden max-w-[5.5rem] truncate text-center font-orbitron text-[8px] tracking-widest sm:block sm:max-w-none sm:whitespace-nowrap"
        style={{ color: active ? `${vehicle.color}99` : '#374151' }}
      >
        {vehicle.label}
      </span>
    </button>
  )
}
