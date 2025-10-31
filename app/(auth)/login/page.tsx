"use client"
import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    
    const res = await signIn('credentials', { 
      username, 
      password, 
      redirect: false 
    })
    
    if ((res as any)?.error) {
      setError((res as any).error)
    } else if (res?.ok) {
      // Redirect manually after successful login
      router.push(callbackUrl)
      router.refresh()
    }
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="w-full border rounded p-2" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="w-full border rounded p-2" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button className="w-full h-10 bg-blue-600 text-white rounded" type="submit">Login</button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto py-16"><p>Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}


