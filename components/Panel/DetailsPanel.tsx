"use client"
import { useEffect, useState } from 'react'

export default function DetailsPanel() {
  const [selected, setSelected] = useState<any>(null)
  useEffect(() => {
    function onSel(e: any) { setSelected(e.detail) }
    window.addEventListener('graph:selected', onSel as any)
    return () => window.removeEventListener('graph:selected', onSel as any)
  }, [])

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <h2 className="text-xl font-semibold">Details</h2>
      {!selected && <p className="text-sm text-gray-500">Select a node to view recommendations and pathways.</p>}
      {selected && (
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-wide text-gray-500">{selected.type}</div>
          <div className="text-lg font-medium">{selected.label}</div>
          {selected.summary && <p className="text-sm text-gray-700">{selected.summary}</p>}
          {selected.pathway?.length ? (
            <div>
              <div className="font-semibold mb-1">Example pathway</div>
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


