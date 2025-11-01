"use client"
import { useEffect, useRef, useState } from 'react'

type Msg = { 
  id: string; 
  role: 'user'|'assistant'; 
  content: string;
  recommendations?: {
    courses: Array<{ title: string; url: string }>;
    clubs: Array<{ title: string; url: string }>;
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isExpanded) {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
      inputRef.current?.focus()
    }
  }, [messages, isExpanded])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    
    const userContent = input.trim()
    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: userContent }
    setMessages(m => [...m, userMsg])
    setInput('')
    setError('')
    setLoading(true)
    
    // Auto-expand when sending a message
    if (!isExpanded) setIsExpanded(true)

    try {
      const res = await fetch('/api/ai/chat', { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: userContent }) 
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`)
      }

      const contentType = res.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format')
      }

      const data = await res.json()
      
      if (!data.text) {
        throw new Error('No response text received')
      }

      setMessages(m => [...m, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: data.text,
        recommendations: data.recommendations 
      }])
    } catch (error: any) {
      console.error('Chat error:', error)
      setError(error.message || 'Failed to send message')
      setMessages(m => [...m, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally {
      setLoading(false)
    }
  }

  const lastMessage = messages[messages.length - 1]
  const lastMessagePreview = lastMessage 
    ? (lastMessage.role === 'user' ? `You: ${lastMessage.content.slice(0, 50)}${lastMessage.content.length > 50 ? '...' : ''}` 
       : `AI: ${lastMessage.content.slice(0, 50)}${lastMessage.content.length > 50 ? '...' : ''}`)
    : ''

  // Collapsed view (bottom left corner)
  if (!isExpanded) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[400px] transition-all"
        >
          <div className="flex-1 text-left">
            <div className="text-xs font-semibold mb-1">AI Career Coach</div>
            {lastMessagePreview ? (
              <div className="text-sm opacity-90">{lastMessagePreview}</div>
            ) : (
              <div className="text-sm opacity-75">Click to start chatting...</div>
            )}
          </div>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      </div>
    )
  }

  // Expanded view (modal/popup)
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={() => setIsExpanded(false)}
      />
      
      {/* Chat Modal */}
      <div className="fixed bottom-4 left-4 z-50 bg-white rounded-lg shadow-2xl flex flex-col w-[500px] h-[600px] max-h-[80vh] border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-lg">
          <div className="font-semibold">AI Career Coach</div>
          <button
            onClick={() => setIsExpanded(false)}
            className="hover:bg-blue-700 rounded p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
        >
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-lg font-medium mb-2">Start a conversation</p>
              <p className="text-sm">Ask about careers, internships, or career paths!</p>
            </div>
          ) : (
            messages.map(m => (
              <div key={m.id}>
                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
                
                {/* Recommendations */}
                {m.role === 'assistant' && m.recommendations && (m.recommendations.courses.length > 0 || m.recommendations.clubs.length > 0) && (
                  <div className="mt-2 ml-0 max-w-[80%]">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <div className="font-semibold text-green-900 mb-2">📚 Recommended Resources</div>
                      
                      {m.recommendations.courses.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-green-800 mb-1">Courses:</div>
                          <ul className="space-y-1">
                            {m.recommendations.courses.map((course, i) => (
                              <li key={i}>
                                <a 
                                  href={course.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs"
                                >
                                  {course.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {m.recommendations.clubs.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-green-800 mb-1">Clubs:</div>
                          <ul className="space-y-1">
                            {m.recommendations.clubs.map((club, i) => (
                              <li key={i}>
                                <a 
                                  href={club.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-xs"
                                >
                                  {club.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={onSend} className="p-4 border-t bg-white rounded-b-lg">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              className="flex-1 border rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask for tailored steps, resources, internships..."
              disabled={loading}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSend(e)
                }
              }}
            />
            <button
              className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              type="submit"
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                'Send'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}


