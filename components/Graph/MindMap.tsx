"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// Import 2D build directly to avoid optional VR/AFRAME side-effects on the client
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

type GraphNode = { id: string; label: string; type: 'career' | 'skill' }
type GraphLink = { source: string; target: string; weight?: number }
type GraphData = { nodes: GraphNode[]; links: GraphLink[]; centerId: string; selected?: any }

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function MindMap() {
  const { data: session } = useSession()
  const router = useRouter()
  const [centerStack, setCenterStack] = useState<string[]>([])
  const [centerId, setCenterId] = useState<string | null>(null)
  const { data, mutate } = useSWR<GraphData>(`/api/graph${centerId ? `?center=${encodeURIComponent(centerId)}` : ''}`, fetcher)

  useEffect(() => {
    if (data?.centerId) setCenterId(data.centerId)
    if (data?.selected) {
      window.dispatchEvent(new CustomEvent('graph:selected', { detail: data.selected }))
    }
  }, [data?.centerId, data?.selected])

  const graphData = useMemo(() => ({ nodes: data?.nodes || [], links: data?.links || [] }), [data])

  const onNodeClick = useCallback((node: GraphNode) => {
    if (!node?.id) return
    
    // Check if user is authenticated (except for the 'career' center node)
    if (node.id !== 'career' && !session?.user) {
      // Redirect to login with callback URL
      const currentUrl = window.location.pathname + window.location.search
      router.push(`/login?callbackUrl=${encodeURIComponent(currentUrl)}`)
      return
    }
    
    // If clicking on 'career' node, reset to main page view
    if (node.id === 'career') {
      setCenterStack([])
      setCenterId(null)
      mutate()
      // Clear selection when going back to main view
      window.dispatchEvent(new CustomEvent('graph:selected', { 
        detail: null
      }))
      return
    }
    
    // Emit selection event immediately
    const selectedNode = graphData.nodes.find(n => n.id === node.id)
    if (selectedNode) {
      window.dispatchEvent(new CustomEvent('graph:selected', { 
        detail: {
          id: selectedNode.id,
          type: selectedNode.type,
          label: selectedNode.label,
          summary: null,
          pathway: []
        }
      }))
    }
    
    // Navigate if clicking a different node (both careers and skills can become center)
    if (node.id !== centerId) {
    setCenterStack(s => [centerId || 'career', ...s])
    setCenterId(node.id)
    mutate()
    }
  }, [centerId, mutate, graphData.nodes, session, router])

  const onRevert = useCallback(() => {
    setCenterStack(s => {
      const [prev, ...rest] = s
      if (!prev) return s
      setCenterId(prev)
      mutate()
      return rest
    })
  }, [mutate])

  // Calculate node size based on label length
  const getNodeSize = useCallback((node: GraphNode) => {
    const label = node.label || ''
    const baseSize = 40
    const additionalSize = label.length * 3
    return baseSize + additionalSize
  }, [])

  const fgRef = useRef<any>(null)
  
  // Configure d3 forces after graph loads
  useEffect(() => {
    if (!fgRef.current || !graphData.nodes.length) return
    
    const linkForce = fgRef.current.d3Force('link')
    if (linkForce) {
      linkForce.distance(200)
      linkForce.strength(0.05)
    }
  }, [graphData.nodes, graphData.links])
  
  useEffect(() => {
    if (!fgRef.current || !data?.centerId) return
    const node = graphData.nodes.find(n => n.id === data.centerId)
    if (node) setTimeout(() => fgRef.current.centerAt(0, 0, 500), 0)
  }, [graphData.nodes, data?.centerId])

  return (
    <div className="h-full w-full relative pointer-events-auto">
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <button className="px-3 py-1 rounded bg-gray-800 text-white disabled:opacity-50" onClick={onRevert} disabled={centerStack.length === 0}>Revert</button>
      </div>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        onNodeClick={onNodeClick as any}
        nodeLabel={(n: any) => n.label}
        // Massive repulsion to spread nodes far apart
        nodeRepulsion={k => k * 50000}
        // Fixed edge length of 200px
        linkDistance={200}
        linkStrength={0.05}
        // Center force to keep graph centered
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.label
          const fontSize = Math.max(12, 14 / Math.sqrt(globalScale))
          ctx.font = `600 ${fontSize}px sans-serif`
          const textWidth = ctx.measureText(label).width
          const padding = 12
          const bckgDimensions = [textWidth + padding * 2, fontSize + padding * 2]
          
          // Draw shadow for depth
          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
          ctx.shadowBlur = 4
          ctx.shadowOffsetX = 2
          ctx.shadowOffsetY = 2
          
          // Draw rounded rectangle background
          ctx.fillStyle = node.type === 'career' ? 'rgba(59,130,246,0.95)' : 'rgba(16,185,129,0.95)'
          ctx.beginPath()
          ctx.roundRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1], 8)
          ctx.fill()
          
          // Reset shadow
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
          
          // Draw text
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = 'white'
          ctx.fillText(label, node.x, node.y)
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const label = node.label
          const fontSize = 14
          ctx.font = `600 ${fontSize}px sans-serif`
          const width = ctx.measureText(label).width + 24
          const height = fontSize + 24
          ctx.fillStyle = color
          ctx.fillRect(node.x - width / 2, node.y - height / 2, width, height)
        }}
        nodeAutoColorBy={(n: any) => n.type}
        linkColor={() => 'rgba(100,100,100,0.2)'}
        linkWidth={1}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleWidth={2}
        // More cooldown ticks for better stabilization with large spacing
        cooldownTicks={500}
        // Enable pan and zoom
        enablePanInteraction={true}
        enableZoomInteraction={true}
        // Better initial positioning
        onEngineStop={() => {
          if (fgRef.current && data?.centerId) {
            fgRef.current.centerAt(0, 0, 500)
          }
        }}
      />
    </div>
  )
}


