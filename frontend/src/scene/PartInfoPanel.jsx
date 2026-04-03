const ROLE_BADGE = {
  wheel: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  door: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  brakeLight: 'bg-red-500/15 text-red-300 border-red-500/40',
  other: 'bg-gray-500/10 text-gray-400 border-gray-600/50',
}

const ROLE_HINT = {
  wheel: 'Wheel assembly',
  door: 'Door',
  brakeLight: 'Brake / tail lamp',
  other: 'Non-driven',
}

export function PartInfoPanel({ info, onClose, pickModeActive }) {
  if (!info) return null

  const badgeClass = ROLE_BADGE[info.role] ?? ROLE_BADGE.other
  const hint = ROLE_HINT[info.role] ?? 'Part'

  return (
    <div
      className="pointer-events-auto absolute left-3 top-3 z-40 w-[min(92vw,320px)] rounded-xl border border-cyan-500/25 bg-[#0a0a14]/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md max-sm:left-2 max-sm:top-2 max-sm:p-2.5"
      role="region"
      aria-label="Selected part details"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-orbitron text-[9px] uppercase tracking-[0.25em] text-cyan-700">
            Part inspector
          </p>
          <h3 className="mt-1 break-words font-orbitron text-xs font-semibold leading-snug text-cyan-100">
            {info.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border border-gray-600 px-2 py-0.5 font-orbitron text-[10px] text-gray-400 hover:border-gray-500 hover:text-gray-200"
          aria-label="Dismiss part info"
        >
          ×
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 font-orbitron text-[8px] uppercase tracking-widest ${badgeClass}`}
        >
          {hint}
        </span>
        {pickModeActive && (
          <span className="font-orbitron text-[8px] text-amber-200/80">
            Pick mode — drag disabled; scroll to zoom
          </span>
        )}
      </div>

      {info.hitName && (
        <p className="mb-2 font-orbitron text-[9px] text-gray-500">
          Mesh hit: <span className="text-cyan-600/90">{info.hitName}</span>
          {info.rootName && info.rootName !== info.hitName && (
            <>
              <span className="text-gray-600"> · Assembly </span>
              <span className="text-cyan-600/90">{info.rootName}</span>
            </>
          )}
        </p>
      )}

      <ul className="list-inside list-disc space-y-1.5 font-orbitron text-[9px] leading-relaxed text-gray-400">
        {info.bullets.map((line, i) => (
          <li key={i} className="marker:text-cyan-800">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}
