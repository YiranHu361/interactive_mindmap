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
    
    // Use Perplexity API for web browsing
    if (process.env.PERPLEXITY_API_KEY) {
      try {
        const perplexity = new OpenAI({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseURL: 'https://api.perplexity.ai',
        } as any)
        
        // Build context-aware prompt with university information
        const systemPrompt = university
          ? `You are a concise college career coach helping a student at ${university}. Use web search to provide current, accurate information about careers, internships, and opportunities specific to ${university} when relevant. Give concrete next steps with sources when possible.`
          : 'You are a concise college career coach. Use web search to provide current, accurate information about careers, internships, and opportunities. Give concrete next steps with sources when possible.'
        
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

  return NextResponse.json({ text })
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}


