import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = (credentials as any)?.username as string | undefined
        const password = (credentials as any)?.password as string | undefined
        if (!username || !password) return null
        const user = await prisma.user.findUnique({ where: { username } })
        if (!user) return null
        const ok = await bcrypt.compare(password, user.hashedPassword)
        if (!ok) return null
        return { id: user.id, name: user.username }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) token.uid = (user as any).id
      return token
    },
    async session({ session, token }: { session: any; token: any }) {
      ;(session as any).user.id = (token as any).uid
      return session
    },
  },
}


