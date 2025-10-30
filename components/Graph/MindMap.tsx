"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'

// Import 2D build directly to avoid optional VR/AFRAME side-effects on the client
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type GraphNode = { id: string; label: string; type: 'career' | 'skill' }
type GraphLink = { source: string; target: string; weight?: number }
type GraphData = { nodes: GraphNode[]; links: GraphLink[]; centerId: string; selected?: any }

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function MindMap() {
  const [centerStack, setCenterStack] = useState<string[]>([])
  const [centerId, setCenterId] = useState<string | null>(null)
  const { data, mutate } = useSWR<GraphData>(`/api/graph${centerId ? `?center=${encodeURIComponent(centerId)}` : ''}`, fetcher)

  useEffect(() => {
    if (data?.centerId) setCenterId(data.centerId)
    if (data?.selected) {
      window.dispatchEvent(new CustomEvent('graph:selected', { detail: data.selected }))
    }
  }, [data?.centerId, data?.selected])

  const onNodeClick = useCallback((node: GraphNode) => {
    if (!node?.id || node.id === centerId) return
    setCenterStack(s => [centerId || 'career', ...s])
    setCenterId(node.id)
    mutate()
  }, [centerId, mutate])

  const onRevert = useCallback(() => {
    setCenterStack(s => {
      const [prev, ...rest] = s
      if (!prev) return s
      setCenterId(prev)
      mutate()
      return rest
    })
  }, [mutate])

  const graphData = useMemo(() => ({ nodes: data?.nodes || [], links: data?.links || [] }), [data])

  const fgRef = useRef<any>(null)
  useEffect(() => {
    if (!fgRef.current || !data?.centerId) return
    const node = graphData.nodes.find(n => n.id === data.centerId)
    if (node) setTimeout(() => fgRef.current.centerAt(0, 0, 500), 0)
  }, [graphData.nodes, data?.centerId])

  return (
    <div className="h-full relative">
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <button className="px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-50" onClick={onRevert} disabled={centerStack.length === 0}>Revert</button>
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        onNodeClick={onNodeClick as any}
        nodeLabel={(n: any) => n.label}
        nodeAutoColorBy={(n: any) => n.type}
        linkColor={() => 'rgba(100,100,100,0.3)'}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.004}
        cooldownTicks={60}
      />
    </div>
  )
}


