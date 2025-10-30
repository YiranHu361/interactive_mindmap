import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const center = searchParams.get('center') || 'career'
  // two-hop around center
  const centerNode = await prisma.node.findUnique({ where: { id: center } }) || await prisma.node.findFirst({ where: { label: 'career' } })
  if (!centerNode) return NextResponse.json({ nodes: [], links: [], centerId: 'career' })

  const firstHopEdges = await prisma.edge.findMany({ where: { OR: [{ sourceId: centerNode.id }, { targetId: centerNode.id }] } })
  const firstHopIds = Array.from(new Set(firstHopEdges.map(e => e.sourceId === centerNode.id ? e.targetId : e.sourceId)))
  const firstHopNodes = await prisma.node.findMany({ where: { id: { in: firstHopIds } } })

  const orConditions: any[] = []
  for (const id of firstHopIds) {
    orConditions.push({ sourceId: id })
    orConditions.push({ targetId: id })
  }
  const secondHopEdges = await prisma.edge.findMany({ where: { OR: orConditions } })
  const secondHopIds = Array.from(new Set(secondHopEdges.flatMap(e => [e.sourceId, e.targetId])))
  const secondHopNodes = await prisma.node.findMany({ where: { id: { in: secondHopIds } } })

  const nodeMap = new Map<string, any>()
  ;[centerNode, ...firstHopNodes, ...secondHopNodes].forEach(n => nodeMap.set(n.id, { id: n.id, label: n.label, type: n.type as any }))

  const links = [...firstHopEdges, ...secondHopEdges].map(e => ({ source: e.sourceId, target: e.targetId, weight: e.weight || 1 }))

  const selected = {
    id: centerNode.id,
    type: centerNode.type,
    label: centerNode.label,
    summary: centerNode.summary,
    pathway: ((centerNode.metadata as any)?.pathway ?? []) as string[],
  }

  return NextResponse.json({ nodes: Array.from(nodeMap.values()), links, centerId: centerNode.id, selected })
}


