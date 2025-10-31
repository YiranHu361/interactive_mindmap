"use client"
import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'

// Component to render text with hyperlinks
function TextWithLinks({ text, links }: { text: string; links: Array<{ text: string; url: string }> }) {
  if (!links || links.length === 0) return <>{text}</>
  
  const parts: Array<{ type: 'text' | 'link'; content: string; url?: string }> = []
  
  // Process links and find all matches
  const linkMatches: Array<{ start: number; end: number; link: { text: string; url: string } }> = []
  
  links.forEach(link => {
    const escapedText = link.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedText, 'gi')
    let match
    // Reset regex lastIndex to start from beginning
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      linkMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        link
      })
    }
  })
  
  // Sort matches by position and remove overlaps (keep first match)
  linkMatches.sort((a, b) => a.start - b.start)
  const nonOverlappingMatches: typeof linkMatches = []
  linkMatches.forEach(match => {
    const overlaps = nonOverlappingMatches.some(existing => 
      (match.start < existing.end && match.end > existing.start)
    )
    if (!overlaps) {
      nonOverlappingMatches.push(match)
    }
  })
  
  // Build parts array
  let lastIndex = 0
  nonOverlappingMatches.forEach(match => {
    // Add text before the link
    if (match.start > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.start) })
    }
    // Add the link
    parts.push({ type: 'link', content: match.link.text, url: match.link.url })
    lastIndex = match.end
  })
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) })
  }
  
  // If no matches found, return original text
  if (parts.length === 0) {
    return <>{text}</>
  }
  
  return (
    <>
      {parts.map((part, index) => 
        part.type === 'link' ? (
          <a 
            key={index}
            href={part.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          >
            {part.content}
          </a>
        ) : (
          <span key={index}>{part.content}</span>
        )
      )}
    </>
  )
}

export default function Insights() {
  const [selected, setSelected] = useState<any>(null)
  const [careerInfo, setCareerInfo] = useState<{ 
    description: string; 
    pathway: string[]; 
    descriptionUrls?: Array<{ text: string; url: string }>;
    pathwayUrls?: Array<Array<{ text: string; url: string }>>;
    income?: { average?: string; range?: string }; 
    cached?: boolean 
  } | null>(null)
  const [skillLearning, setSkillLearning] = useState<{ classes: Array<{ title: string; url?: string }>; clubs: Array<string | { title: string; url?: string }>; cached?: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [restoring, setRestoring] = useState(true)
  const [careerError, setCareerError] = useState<string | null>(null)
  const [skillError, setSkillError] = useState<string | null>(null)
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastRegenerateRef = useRef<number>(0)
  const { data: session } = useSession()

  // Load persisted selected node on mount
  useEffect(() => {
    const savedSelected = sessionStorage.getItem('selectedNode')
    if (savedSelected) {
      try {
        const parsed = JSON.parse(savedSelected)
        setSelected(parsed)
        setLoading(true)
        // Restore the cached data if available
        if (parsed.type === 'career' && parsed.id !== 'career') {
          fetch(`/api/career?career=${encodeURIComponent(parsed.label)}`)
            .then(res => res.json())
            .then(data => {
              setCareerInfo(data)
              setLoading(false)
              setRestoring(false)
            })
            .catch(() => {
              setLoading(false)
              setRestoring(false)
            })
        } else if (parsed.type === 'skill') {
          fetch(`/api/skill/learning?skill=${encodeURIComponent(parsed.label)}`)
            .then(res => res.json())
            .then(data => {
              setSkillLearning(data)
              setLoading(false)
              setRestoring(false)
            })
            .catch(() => {
              setLoading(false)
              setRestoring(false)
            })
        } else {
          setLoading(false)
          setRestoring(false)
        }
      } catch (e) {
        console.error('Error restoring selected node:', e)
        setLoading(false)
        setRestoring(false)
      }
    } else {
      setRestoring(false)
    }
  }, [])

  useEffect(() => {
    function onSel(e: any) { 
      setSelected(e.detail)
      setRestoring(false) // Ensure we're not in restore mode when user clicks
      // Persist selected node to sessionStorage
      if (e.detail) {
        sessionStorage.setItem('selectedNode', JSON.stringify(e.detail))
      } else {
        sessionStorage.removeItem('selectedNode')
      }
      // Clear previous info immediately
      setCareerInfo(null)
      setSkillLearning(null)
      setCareerError(null)
      setSkillError(null)
      // Set loading state - will be set again in useEffect but this ensures immediate feedback
      if (e.detail && ((e.detail.type === 'career' && e.detail.id !== 'career') || e.detail.type === 'skill')) {
        setLoading(true)
      } else {
        setLoading(false)
      }
    }
    window.addEventListener('graph:selected', onSel as any)
    return () => window.removeEventListener('graph:selected', onSel as any)
  }, [])

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
      }
    }
  }, [])

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setCooldownRemaining(prev => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) {
              clearInterval(cooldownTimerRef.current)
              cooldownTimerRef.current = null
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
        cooldownTimerRef.current = null
      }
    }
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current)
      }
    }
  }, [cooldownRemaining])

  // Debug: Log loading state changes
  useEffect(() => {
    console.log('Loading state changed:', loading, 'Selected:', selected?.label, 'CareerInfo:', !!careerInfo)
  }, [loading, selected, careerInfo])

  // Fetch career information when a career node is selected (but not during restore)
  useEffect(() => {
    if (restoring) {
      return // Don't fetch during restore
    }
    if (!selected || selected.type !== 'career' || selected.id === 'career') {
      setCareerInfo(null)
      setLoading(false)
      return
    }

    // Set loading state immediately
    setLoading(true)
    setCareerError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    fetch(`/api/career?career=${encodeURIComponent(selected.label)}`, {
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(data => {
        console.log('Career API response:', data) // Debug log
        // Always set the data if we got a valid response
        setCareerInfo(data)
        setLoading(false)
        setCareerError(null)
      })
      .catch(error => {
        clearTimeout(timeoutId)
        if (error.name !== 'AbortError') {
          console.error('Error fetching career info:', error)
          setCareerError('Failed to load career information. Please try again.')
        }
        setLoading(false)
      })
    
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [selected, restoring])

  // Fetch learning resources when a skill node is selected (but not during restore)
  useEffect(() => {
    if (restoring) {
      return // Don't fetch during restore
    }
    if (!selected || selected.type !== 'skill') {
      setSkillLearning(null)
      setLoading(false)
      return
    }

    // Set loading state immediately
    console.log('[Insights] Setting loading=true for skill:', selected.label)
    setLoading(true)
    setSkillError(null)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    const url = `/api/skill/learning?skill=${encodeURIComponent(selected.label)}`
    
    fetch(url, {
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(data => {
        console.log('[Insights] Received skill data, setting loading=false')
        setSkillLearning(data)
        setLoading(false)
      })
      .catch(error => {
        clearTimeout(timeoutId)
        if (error.name !== 'AbortError') {
          console.error('Error fetching skill learning info:', error)
          setSkillError('Failed to load learning resources. Please try again.')
        }
        setLoading(false)
      })
    
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [selected, restoring])

  const handleRegenerate = async () => {
    const now = Date.now()
    const timeSinceLastRegenerate = now - lastRegenerateRef.current
    
    // Check cooldown (15 seconds = 15000ms)
    if (timeSinceLastRegenerate < 15000) {
      const remaining = Math.ceil((15000 - timeSinceLastRegenerate) / 1000)
      setCooldownRemaining(remaining)
      return
    }

    setRegenerating(true)
    setLoading(true)
    lastRegenerateRef.current = now
    setCooldownRemaining(15)

    try {
      if (selected?.type === 'career') {
        setCareerError(null)
        const res = await fetch(`/api/career?career=${encodeURIComponent(selected.label)}&regenerate=true`)
        const data = await res.json()
        setCareerInfo(data)
      } else if (selected?.type === 'skill') {
        setSkillError(null)
        const res = await fetch(`/api/skill/learning?skill=${encodeURIComponent(selected.label)}&regenerate=true`)
        const data = await res.json()
        setSkillLearning(data)
      }
    } catch (error) {
      console.error('Error regenerating content:', error)
    } finally {
      setRegenerating(false)
      setLoading(false)
    }
  }

  return (
    <div 
      className="h-full w-full overflow-y-auto overflow-x-hidden p-4 space-y-4 overscroll-contain"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <h2 className="text-xl font-semibold">Career Details</h2>
      {!selected && (
        <p className="text-sm text-gray-500">Click a career or skill node to see detailed information.</p>
      )}
      {selected && selected.id === 'career' && (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{selected.type}</div>
          <div className="text-lg font-semibold">{selected.label}</div>
          <p className="text-sm text-gray-700">Click on a specific career to see detailed information and career pathways.</p>
        </div>
      )}
      {selected && selected.type === 'career' && selected.id !== 'career' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{selected.type}</div>
              <div className="text-lg font-semibold">{selected.label}</div>
            </div>
            {(careerInfo || loading) && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating || cooldownRemaining > 0}
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {regenerating ? 'Regenerating...' : cooldownRemaining > 0 ? `Regenerate (${cooldownRemaining}s)` : 'Regenerate'}
              </button>
            )}
          </div>

          {loading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    {careerInfo ? 'Regenerating career information...' : 'Generating career information...'}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    AI is searching for current data and creating personalized content. This may take 10-15 seconds.
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && careerError && (
            <div className="text-sm text-gray-500">
              {careerError}
            </div>
          )}

          {careerInfo && !loading && (
            <>
              {careerInfo.cached && (
                <div className="text-xs text-gray-500 italic mb-2">Showing cached content</div>
              )}
              {/* Comprehensive Description */}
              <div className="space-y-2">
                <div className="font-semibold text-base">About This Career</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {careerInfo.descriptionUrls && careerInfo.descriptionUrls.length > 0 ? (
                    <TextWithLinks text={careerInfo.description} links={careerInfo.descriptionUrls} />
                  ) : (
                    careerInfo.description
                  )}
                </div>
              </div>

              {/* Income Information */}
              {careerInfo.income && (careerInfo.income.average || careerInfo.income.range) && (
                <div className="space-y-2">
                  <div className="font-semibold text-base">Salary Information</div>
                  <div className="text-sm text-gray-700">
                    {careerInfo.income.average && (
                      <div>Average: {careerInfo.income.average}</div>
                    )}
                    {careerInfo.income.range && (
                      <div>Range: {careerInfo.income.range}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Career Pathway */}
              {careerInfo.pathway && careerInfo.pathway.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-base">Career Pathway</div>
                  <div className="text-sm text-gray-600 mb-2">
                    Follow these steps to pursue this career:
                  </div>
                  <ol className="list-decimal ml-5 space-y-2">
                    {careerInfo.pathway.map((step: string, i: number) => (
                      <li key={i} className="text-sm text-gray-700 leading-relaxed">
                        {careerInfo.pathwayUrls && careerInfo.pathwayUrls[i] && careerInfo.pathwayUrls[i].length > 0 ? (
                          <TextWithLinks text={step} links={careerInfo.pathwayUrls[i]} />
                        ) : (
                          step
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {selected && selected.type === 'skill' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{selected.type}</div>
              <div className="text-lg font-semibold">{selected.label}</div>
            </div>
            {(skillLearning || loading) && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating || cooldownRemaining > 0}
                className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {regenerating ? 'Regenerating...' : cooldownRemaining > 0 ? `Regenerate (${cooldownRemaining}s)` : 'Regenerate'}
              </button>
            )}
          </div>

          {loading && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-green-900">
                    {skillLearning ? 'Regenerating learning resources...' : 'Generating learning resources...'}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    AI is searching for courses and clubs at your university. This may take 10-15 seconds.
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && skillError && (
            <div className="text-sm text-gray-500">
              {skillError}
            </div>
          )}

          {skillLearning && !loading && (
            <>
              {skillLearning.cached && (
                <div className="text-xs text-gray-500 italic">Showing cached content</div>
              )}
              {/* Classes */}
              {skillLearning.classes && skillLearning.classes.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-base">Recommended Courses</div>
                  <div className="text-sm text-gray-600 mb-2">
                    Classes you can take to learn {selected.label}:
                  </div>
                  <ul className="list-disc ml-5 space-y-1">
                    {skillLearning.classes.map((course: { title: string; url?: string }, i: number) => (
                      <li key={i} className="text-sm text-gray-700">
                        {course.url ? (
                          <a href={course.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {course.title}
                          </a>
                        ) : (
                          course.title
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clubs */}
              {skillLearning.clubs && skillLearning.clubs.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold text-base">Student Clubs & Organizations</div>
                  <div className="text-sm text-gray-600 mb-2">
                    Join these clubs to practice and network around {selected.label}:
                  </div>
                  <ul className="list-disc ml-5 space-y-1">
                    {skillLearning.clubs.map((club: string | { title: string; url?: string }, i: number) => (
                      <li key={i} className="text-sm text-gray-700">
                        {typeof club === 'string' ? (
                          club
                        ) : club.url ? (
                          <a href={club.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {club.title}
                          </a>
                        ) : (
                          club.title
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(!skillLearning.classes || skillLearning.classes.length === 0) && 
               (!skillLearning.clubs || skillLearning.clubs.length === 0) && (
                <div className="text-sm text-gray-500">
                  No learning resources found for this skill.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
