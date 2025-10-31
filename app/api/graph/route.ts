import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function mockResponse() {
  const careers = ['Software Engineer','Data Scientist','Product Manager','UX Designer','DevOps Engineer','Cybersecurity Analyst','Marketing Manager','Sales Engineer','Quant Researcher','Mechanical Engineer','Bioinformatics Scientist','Policy Analyst','Teacher','Entrepreneur','Investment Analyst']
  
  const nodes: any[] = [{ id: 'career', label: 'career', type: 'career' }]
  const links: any[] = []
  
  // Only add 2 layers: center + careers (no skills)
  for (const c of careers) {
    nodes.push({ id: c, label: c, type: 'career' })
    links.push({ source: 'career', target: c })
  }
  
  return NextResponse.json({ nodes, links, centerId: 'career', selected: { id: 'career', type: 'career', label: 'career', pathway: [] } })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const center = searchParams.get('center') || 'career'
  // If no DB configured, or if DB access fails, return mock dataset so UI still works
  if (!process.env.DATABASE_URL) return mockResponse()

  try {
    // Get center node and its direct connections (careers and skills)
    const centerNode = await prisma.node.findUnique({ where: { id: center } }) || await prisma.node.findFirst({ where: { label: 'career' } })
    if (!centerNode) return NextResponse.json({ nodes: [], links: [], centerId: 'career' })

    // Get all edges connected to center
    const firstHopEdges = await prisma.edge.findMany({ where: { OR: [{ sourceId: centerNode.id }, { targetId: centerNode.id }] } })
    const firstHopIds = Array.from(new Set(firstHopEdges.map(e => e.sourceId === centerNode.id ? e.targetId : e.sourceId)))
    const firstHopNodes = await prisma.node.findMany({ where: { id: { in: firstHopIds } } })

    const nodeMap = new Map<string, any>()
    ;[centerNode, ...firstHopNodes].forEach(n => nodeMap.set(n.id, { id: n.id, label: n.label, type: n.type as any }))

    // Only show 2 layers: center + direct connections (no skills in initial view)
    // Include all links connected to center node - use IDs for links
    const links = firstHopEdges.map(e => {
      const sourceNode = nodeMap.get(e.sourceId)
      const targetNode = nodeMap.get(e.targetId)
      if (!sourceNode || !targetNode) return null
      // Use IDs for links - react-force-graph-2d can handle both IDs and objects, but IDs are more reliable
      return { source: e.sourceId, target: e.targetId, weight: e.weight || 1 }
    }).filter(l => l !== null)

    const selected = {
      id: centerNode.id,
      type: centerNode.type,
      label: centerNode.label,
      summary: centerNode.summary,
      pathway: ((centerNode.metadata as any)?.pathway ?? []) as string[],
    }

    return NextResponse.json({ nodes: Array.from(nodeMap.values()), links, centerId: centerNode.id, selected })
  } catch (e) {
    // If Prisma or DATABASE_URL fails, degrade gracefully to mock data
    return mockResponse()
  }
}


