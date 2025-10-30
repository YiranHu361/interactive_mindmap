import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

export async function POST(req: Request) {
  const { content } = await req.json()
  const nextAuth: any = await import('next-auth')
  const session = await nextAuth.getServerSession(authConfig as any)

  let text = ''
  if (process.env.OPENAI_API_KEY) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a concise college career coach. Give concrete next steps.' },
        { role: 'user', content },
      ],
      temperature: 0.4,
    })
    text = resp.choices[0]?.message?.content || 'No response'
  } else {
    text = `Thanks! I noted: "${content}". Next, try exploring a career node and ask for a pathway.`
  }

  const userId = (session as any)?.user?.id as string | undefined
  if (userId) {
    await prisma.chatMessage.createMany({ data: [
      { userId, role: 'user', content },
      { userId, role: 'assistant', content: text },
    ] })
  }

  return NextResponse.json({ text })
}


