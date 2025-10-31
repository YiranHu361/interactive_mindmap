import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Mock data mapping skills to careers
const mockSkillCareers: Record<string, string[]> = {
  'Python': ['Software Engineer', 'Data Scientist', 'DevOps Engineer'],
  'JavaScript': ['Software Engineer', 'UX Designer', 'Product Manager'],
  'SQL': ['Data Scientist', 'Investment Analyst', 'Product Manager'],
  'Communication': ['Marketing Manager', 'Sales Engineer', 'Teacher', 'Product Manager'],
  'Project Management': ['Product Manager', 'Entrepreneur', 'DevOps Engineer'],
  'Data Analysis': ['Data Scientist', 'Investment Analyst', 'Policy Analyst'],
  'Machine Learning': ['Data Scientist', 'Bioinformatics Scientist', 'Quant Researcher'],
  'UI/UX Design': ['UX Designer', 'Product Manager', 'Software Engineer'],
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const skillId = searchParams.get('skill')
    
    if (!skillId) {
      return NextResponse.json({ error: 'Skill ID is required' }, { status: 400 })
    }

    // If no DB configured, return mock data
    if (!process.env.DATABASE_URL) {
      const careerLabels = mockSkillCareers[skillId] || []
      const careers = careerLabels.map(label => ({
        id: label,
        label: label,
        type: 'career',
        summary: `${label} is a career that uses ${skillId}.`
      }))
      return NextResponse.json({ careers })
    }

    // Find all careers connected to this skill
    const edges = await prisma.edge.findMany({
      where: {
        OR: [
          { sourceId: skillId },
          { targetId: skillId }
        ]
      }
    })

    // Get all connected node IDs
    const connectedIds = Array.from(new Set(
      edges.flatMap(e => [e.sourceId, e.targetId]).filter(id => id !== skillId)
    ))

    // Get all connected career nodes
    const careers = await prisma.node.findMany({
      where: {
        id: { in: connectedIds },
        type: 'career'
      }
    })

    return NextResponse.json({ 
      careers: careers.map(c => ({
        id: c.id,
        label: c.label,
        type: c.type,
        summary: c.summary
      }))
    })
  } catch (error: any) {
    console.error('Skill careers API error:', error)
    // Fallback to mock data if DB query fails
    try {
      const { searchParams } = new URL(req.url)
      const skillId = searchParams.get('skill')
      if (skillId && mockSkillCareers[skillId]) {
        const careerLabels = mockSkillCareers[skillId]
        const careers = careerLabels.map(label => ({
          id: label,
          label: label,
          type: 'career',
          summary: `${label} is a career that uses ${skillId}.`
        }))
        return NextResponse.json({ careers })
      }
    } catch {
      // Ignore errors in fallback
    }
    return NextResponse.json(
      { error: 'Server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

