"use client"
import { useEffect, useRef, useState } from 'react'

type Msg = { id: string; role: 'user'|'assistant'; content: string }

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: input }
    setMessages(m => [...m, userMsg])

    const res = await fetch('/api/ai/chat', { method: 'POST', body: JSON.stringify({ content: input }) })
    const data = await res.json()
    setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', content: data.text }])
    setInput('')
  }

  return (
    <div className="p-3 grid grid-cols-3 gap-3">
      <form onSubmit={onSend} className="col-span-2 flex items-end gap-2">
        <textarea className="flex-1 border rounded p-2 h-24" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask for tailored steps, resources, internships..." />
        <button className="h-10 px-4 rounded bg-blue-600 text-white" type="submit">Send</button>
      </form>
      <div ref={scrollRef} className="col-span-1 h-28 overflow-y-auto border rounded p-2 bg-gray-50 text-sm">
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-gray-800' : 'text-blue-800'}>
            <span className="uppercase text-xs mr-1">{m.role}</span>{m.content}
          </div>
        ))}
      </div>
    </div>
  )
}


