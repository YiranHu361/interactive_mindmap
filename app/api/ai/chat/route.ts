import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

export async function POST(req: Request) {
  try {
  const { content } = await req.json()
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Get session using the auth function from NextAuth v5
    const session = await auth()
    
    // Get user's university information (only if we have a userId)
    const userId = (session as any)?.user?.id as string | undefined
    let university = ''
    if (userId) {
      try {
        const user = await prisma.user.findUnique({ 
          where: { id: userId },
          select: { university: true } // Only fetch university field for speed
        })
        university = user?.university || ''
      } catch (err) {
        console.error('Error fetching user university:', err)
      }
    }

  let text = ''
    let recommendations: { courses: Array<{ title: string; url: string }>; clubs: Array<{ title: string; url: string }> } | null = null
    
    // RAG: Find relevant courses and clubs if user is at Berkeley
    if (university && university.toLowerCase().includes('berkeley') && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        })
        
        // Generate embedding for user's message
        const embeddingResponse = await (openai as any).embeddings.create({
          model: 'text-embedding-3-small',
          input: content,
          dimensions: 1536
        })
        
        const queryEmbedding = embeddingResponse.data[0].embedding
        
        // Search for relevant courses
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
          LIMIT 3
        `.catch(() => [])
        
        // Search for relevant organizations
        const orgs = await prisma.$queryRaw<Array<{
          name: string
          url: string | null
          similarity: number
        }>>`
          SELECT 
            name, 
            url,
            1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
          FROM berkeley_organizations
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
          LIMIT 3
        `.catch(() => [])
        
        // Format recommendations
        if (courses.length > 0 || orgs.length > 0) {
          recommendations = {
            courses: courses.map(c => ({
              title: `${c.subject} ${c.course_number}`,
              url: `https://classes.berkeley.edu/search/class/${c.subject.toLowerCase()}%20${c.course_number}`
            })),
            clubs: orgs.map(o => ({
              title: o.name.substring(0, 80),
              url: o.url || ''
            })).filter(c => c.url)
          }
        }
      } catch (error: any) {
        console.error('[Chat API] RAG error:', error.message)
      }
    }
    
    // Use Perplexity API for web browsing
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        const perplexity = new OpenAI({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseURL: 'https://api.perplexity.ai',
        } as any)
        
        // Build context-aware prompt with university information
        const systemPrompt = university
          ? `You are a concise college career coach helping a student at ${university}. Use web search to provide current, accurate information about careers, internships, and opportunities specific to ${university} when relevant. Give concrete next steps with sources when possible. IMPORTANT: Output ONLY plain text. NO markdown formatting, NO bold text (**), NO bullet points with -, NO numbered lists. Write in simple paragraphs with line breaks.`
          : 'You are a concise college career coach. Use web search to provide current, accurate information about careers, internships, and opportunities. Give concrete next steps with sources when possible. IMPORTANT: Output ONLY plain text. NO markdown formatting, NO bold text (**), NO bullet points with -, NO numbered lists. Write in simple paragraphs with line breaks.'
        
        const resp = await perplexity.chat.completions.create({
          model: 'sonar', // Use 'sonar' instead of 'sonar-mini'
      messages: [
            { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.4,
          max_tokens: 500, // Limit response length for speed
    })
    text = resp.choices[0]?.message?.content || 'No response'
      } catch (error: any) {
        console.error('Perplexity API error:', error)
        text = `I'm having trouble connecting to the AI service. Please check your Perplexity API key configuration. Error: ${error?.message || 'Unknown error'}. You can find your API key at https://www.perplexity.ai/settings/api`
      }
  } else {
      text = `Thanks! I noted: "${content}". Next, try exploring a career node and ask for a pathway. To enable AI chat, please configure the PERPLEXITY_API_KEY environment variable.`
  }

  if (userId) {
      try {
        await prisma.chatMessage.createMany({ 
          data: [
      { userId, role: 'user', content },
      { userId, role: 'assistant', content: text },
          ] 
        })
      } catch (error) {
        console.error('Database error saving chat:', error)
        // Don't fail the request if saving fails
      }
  }

  return NextResponse.json({ text, recommendations })
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


