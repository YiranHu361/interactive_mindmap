"use client"
import { useSession, signIn, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function AuthButtons() {
  const { data } = useSession()
  const user = data?.user as any
  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/(auth)/login" className="text-sm text-blue-700">Login</Link>
        <Link href="/(auth)/register" className="text-sm text-blue-700">Register</Link>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600">Hi, {user.name}</span>
      <button className="px-3 py-1 rounded border" onClick={() => signOut({ callbackUrl: '/' })}>Logout</button>
    </div>
  )
}


