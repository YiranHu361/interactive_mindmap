import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const skillName = searchParams.get('skill')
    const regenerate = searchParams.get('regenerate') === 'true'
    
    if (!skillName) {
      return NextResponse.json({ error: 'Skill name is required' }, { status: 400 })
    }

    // Get user session and university
    const session = await auth().catch(() => null)
    const userId = (session as any)?.user?.id as string | undefined
    const university = (session as any)?.user?.university as string | undefined

    console.log(`[Skill API] User: ${userId}, University: ${university}, Skill: ${skillName}, Regenerate: ${regenerate}`)

    // Check if we have a skill node
    const skillNode = await prisma.node.findFirst({
      where: { label: skillName, type: 'skill' }
    }).catch(() => null)

    // Check cache if not regenerating
    if (!regenerate && userId && skillNode) {
      const cachedData = await prisma.userNodeCache.findUnique({
        where: {
          userId_nodeId_cacheType: {
            userId,
            nodeId: skillNode.id,
            cacheType: 'skill'
          }
        }
      }).catch(() => null)

      if (cachedData) {
        console.log(`[Skill Cache HIT] User: ${userId}, Skill: ${skillName}`)
        return NextResponse.json({ 
          ...cachedData.data as any, 
          cached: true 
        })
      }
    }

    // ALGORITHM: Use RAG (Retrieval-Augmented Generation) for semantic search
    const classes: Array<{ title: string; url?: string }> = []
    const clubs: Array<{ title: string; url?: string }> = []

    console.log(`[Skill API] University check: "${university}", includes berkeley: ${university?.toLowerCase().includes('berkeley')}`)
    
    if (university && university.toLowerCase().includes('berkeley')) {
      console.log(`[Skill API] 🔍 Using RAG semantic search for: ${skillName}`)
      
      try {
        // STEP 1: Generate embedding for the skill query
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: skillName,
          dimensions: 1536
        })
        
        const queryEmbedding = embeddingResponse.data[0].embedding
        console.log(`[Skill API] ✅ Generated query embedding (${queryEmbedding.length} dimensions)`)

        // STEP 2: Semantic search for courses using cosine similarity
        const courses = await prisma.$queryRaw<Array<{
          subject: string
          course_number: string
          course_description: string | null
          similarity: number
        }>>`
          SELECT 
            subject, 
            course_number, 
            course_description,
            1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
          FROM berkeley_courses
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
          LIMIT 8
        `.catch(err => {
          console.error('[Skill API] Error in RAG course search:', err.message)
          return []
        })

        console.log(`[Skill API] 📚 Found ${courses.length} semantically similar courses`)
        courses.forEach((c, i) => {
          console.log(`  ${i + 1}. ${c.subject} ${c.course_number} (similarity: ${(c.similarity * 100).toFixed(1)}%)`)
        })

        // STEP 3: Keyword search for organizations (simpler, fewer items)
        const orgs = await prisma.berkeley_organizations.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: skillName,
                  mode: 'insensitive'
                }
              },
              {
                description: {
                  contains: skillName,
                  mode: 'insensitive'
                }
              }
            ]
          },
          take: 6
        }).catch(err => {
          console.error('[Skill API] Error querying Berkeley organizations:', err.message)
          return []
        })

        console.log(`[Skill API] 🎯 Found ${orgs.length} matching Berkeley organizations`)

        // Format results
        courses.forEach(course => {
          classes.push({
            title: `${course.subject} ${course.course_number}${course.course_description ? ': ' + course.course_description.substring(0, 60) + (course.course_description.length > 60 ? '...' : '') : ''}`,
            url: undefined // No URL in schema
          })
        })

        orgs.forEach(org => {
          clubs.push({
            title: org.name,
            url: org.url || undefined
          })
        })

      } catch (error: any) {
        console.error('[Skill API] RAG error:', error.message)
        // Fall back to generic message on error
      }
    }

    // If we don't have enough results, add generic fallback message
    if (classes.length === 0) {
      classes.push({
        title: `Check your university's course catalog for courses related to ${skillName}`
      })
    }

    if (clubs.length === 0) {
      clubs.push({
        title: `Search for student organizations related to ${skillName} on your campus`
      })
    }

    const result = { classes, clubs, university: university || null }

    // Cache the results
    if (skillNode && userId && (classes.length > 0 || clubs.length > 0)) {
      await prisma.userNodeCache.upsert({
        where: {
          userId_nodeId_cacheType: {
            userId,
            nodeId: skillNode.id,
            cacheType: 'skill'
          }
        },
        create: {
          userId,
          nodeId: skillNode.id,
          cacheType: 'skill',
          data: result as any
        },
        update: {
          data: result as any,
          updatedAt: new Date()
        }
      }).catch(err => {
        console.error('[Skill API] Error caching:', err.message)
      })

      console.log(`[Skill Cache SAVED] User: ${userId}, Skill: ${skillName}, Classes: ${classes.length}, Clubs: ${clubs.length}`)
    }

    return NextResponse.json({ ...result, cached: false })

  } catch (error: any) {
    console.error('[Skill API Error]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch learning resources', classes: [], clubs: [] },
      { status: 500 }
    )
  }
}
