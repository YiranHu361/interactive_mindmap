"use client"
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'

export default function AuthButtons() {
  const { data } = useSession()
  const user = data?.user as any
  const [loading, setLoading] = useState(false)
  
  const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      setLoading(true)
      await signOut({ 
        callbackUrl: '/',
        redirect: true 
      })
    } catch (error) {
      console.error('Error signing out:', error)
      setLoading(false)
      // Fallback: redirect manually if signOut fails
      window.location.href = '/'
    }
  }
  
  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm text-blue-700">Login</Link>
        <Link href="/register" className="text-sm text-blue-700">Register</Link>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600">Hi, {user.name}</span>
      <button 
        type="button"
        className="px-3 py-1 rounded border hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
        onClick={handleSignOut}
        disabled={loading}
      >
        {loading ? 'Logging out...' : 'Logout'}
      </button>
    </div>
  )
}


