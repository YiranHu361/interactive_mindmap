"use client"
import { useEffect, useState } from 'react'

export default function Insights() {
  const [selected, setSelected] = useState<any>(null)
  useEffect(() => {
    function onSel(e: any) { setSelected(e.detail) }
    window.addEventListener('graph:selected', onSel as any)
    return () => window.removeEventListener('graph:selected', onSel as any)
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Insights</h2>
      {!selected && <p className="text-sm text-gray-500">Click a career to see a suggested path and key skills.</p>}
      {selected && (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{selected.type}</div>
          <div className="text-lg font-semibold">{selected.label}</div>
          {selected.summary && <p className="text-sm text-gray-700">{selected.summary}</p>}
          {selected.pathway?.length ? (
            <div>
              <div className="font-semibold mb-1">Suggested pathway</div>
              <ol className="list-decimal ml-5 space-y-1">
                {selected.pathway.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}


