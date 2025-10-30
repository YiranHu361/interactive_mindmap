import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const center = searchParams.get('center') || 'career'
  // If no DB configured, return mock dataset so UI still works
  if (!process.env.DATABASE_URL) {
    const careers = ['Software Engineer','Data Scientist','Product Manager','UX Designer','DevOps Engineer','Cybersecurity Analyst','Marketing Manager','Sales Engineer','Quant Researcher','Mechanical Engineer','Bioinformatics Scientist','Policy Analyst','Teacher','Entrepreneur','Investment Analyst']
    const skill = (c: string) => [`${c}_Skill1`,`$${c}_Skill2`.replace('$','')]
    const nodes = [{ id: 'career', label: 'career', type: 'career' } as any]
    const links: any[] = []
    for (const c of careers) {
      nodes.push({ id: c, label: c, type: 'career' })
      links.push({ source: 'career', target: c })
      for (const s of skill(c)) {
        nodes.push({ id: `${c}_${s}`, label: s.replace(`${c}_`, ''), type: 'skill' })
        links.push({ source: c, target: `${c}_${s}` })
      }
    }
    return NextResponse.json({ nodes, links, centerId: 'career', selected: { id: 'career', type: 'career', label: 'career', pathway: [] } })
  }

  // two-hop around center (DB mode)
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


