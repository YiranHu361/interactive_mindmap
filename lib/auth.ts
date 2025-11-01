import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import NextAuth from 'next-auth'

export const authConfig: NextAuthConfig = {
  // Use provided secret or a safe dev fallback to avoid 500s during local runs
  secret: process.env.NEXTAUTH_SECRET || 'devsecret',
  // Allow non-configured NEXTAUTH_URL hosts in dev / preview
  trustHost: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
        const username = (credentials as any)?.username as string | undefined
        const password = (credentials as any)?.password as string | undefined
        if (!username || !password) return null
          
          // Only fetch needed fields for faster query
          const user = await prisma.user.findUnique({ 
            where: { username },
            select: { id: true, username: true, university: true, hashedPassword: true }
          })
        if (!user) return null
          
        const ok = await bcrypt.compare(password, user.hashedPassword)
        if (!ok) return null
          
          return { id: user.id, name: user.username, university: user.university }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      try {
        if (user) {
          token.uid = (user as any).id
          token.university = (user as any).university
        }
        return token
      } catch (error) {
        console.error('JWT callback error:', error)
      return token
      }
    },
    async session({ session, token }: { session: any; token: any }) {
      try {
      ;(session as any).user.id = (token as any).uid
        ;(session as any).user.university = (token as any).university
        return session
      } catch (error) {
        console.error('Session callback error:', error)
      return session
      }
    },
  },
  pages: {
    signIn: '/login',
  },
}

// Export NextAuth instance
export const { auth, handlers, signIn, signOut } = NextAuth(authConfig)


