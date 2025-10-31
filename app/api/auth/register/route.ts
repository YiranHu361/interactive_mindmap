import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, password, university } = body
    
    if (!username || !password || !university) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Username taken' }, { status: 409 })
    }
    
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ 
      data: { username, hashedPassword, university } 
    })
    
    return NextResponse.json({ id: user.id, username: user.username })
  } catch (e: any) {
    console.error('Registration error:', e)
    return NextResponse.json({ 
      error: e.message || 'Server error' 
    }, { status: 500 })
  }
}


