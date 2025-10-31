import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { stripMarkdown } from '@/lib/markdown'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const careerName = searchParams.get('career')
    const regenerate = searchParams.get('regenerate') === 'true'
    
    if (!careerName) {
      return NextResponse.json({ error: 'Career name is required' }, { status: 400 })
    }

    // Check cache and get session in parallel
    const [careerNodeResult, session] = await Promise.all([
      prisma.node.findFirst({ 
        where: { label: careerName, type: 'career' } 
      }).catch(() => null),
      auth().catch(() => null)
    ])

    // If career node doesn't exist, create it
    let careerNode = careerNodeResult
    if (!careerNode) {
      try {
        careerNode = await prisma.node.create({
          data: {
            id: careerName,
            type: 'career',
            label: careerName,
            metadata: {}
          }
        })
      } catch (err) {
        console.error('Error creating career node:', err)
        // Continue even if node creation fails
      }
    }

    const userId = (session as any)?.user?.id as string | undefined
    console.log(`[Career API] User: ${userId}, Career: ${careerName}, Regenerate: ${regenerate}, Node exists: ${!!careerNode}`)

    // Check if we have cached AI-generated content for this user and career
    // Only check cache if user is logged in
    if (!regenerate && userId && careerNode && typeof userId === 'string' && userId.length > 0) {
      try {
        const userCache = await prisma.userNodeCache.findUnique({
          where: {
            userId_nodeId_cacheType: {
              userId,
              nodeId: careerNode.id,
              cacheType: 'career'
            }
          }
        })

        if (userCache) {
          const cachedData = userCache.data as any
          console.log(`[Career Cache CHECK] Found cache for ${careerName}, has description: ${!!cachedData?.description}, has pathway: ${!!cachedData?.pathway}`)
          // Check that cached data exists and is not empty
          if (cachedData?.description && cachedData?.pathway && 
              typeof cachedData.description === 'string' && cachedData.description.trim().length > 0 &&
              Array.isArray(cachedData.pathway) && cachedData.pathway.length > 0) {
            console.log(`[Career Cache HIT] User: ${userId}, Career: ${careerName}`)
            return NextResponse.json({ 
              description: cachedData.description,
              pathway: cachedData.pathway,
              descriptionUrls: cachedData.descriptionUrls || [],
              pathwayUrls: cachedData.pathwayUrls || [],
              income: cachedData.income || {},
              cached: true
            })
          } else {
            console.log(`[Career Cache INVALID] User: ${userId}, Career: ${careerName}, descLen: ${cachedData?.description?.length || 0}, pathwayLen: ${cachedData?.pathway?.length || 0}`)
          }
        } else {
          console.log(`[Career Cache MISS] No cache found for User: ${userId}, Career: ${careerName}`)
        }
      } catch (cacheError: any) {
        console.error('Error checking user cache:', cacheError)
        // Continue to generate new content if cache check fails
      }
    } else {
      console.log(`[Career Cache SKIP] Regenerate: ${regenerate}, UserId: ${userId}, Node: ${!!careerNode}`)
    }

    // Generate new content (either no cache or regenerate requested)
    let description = ''
    let pathway: string[] = []
    let descriptionUrls: Array<{ text: string; url: string }> = []
    let pathwayUrls: Array<Array<{ text: string; url: string }>> = []
    let income: { average?: string; range?: string } = {}

    // Get user's chat history for context (if applicable) - reduced to 5 messages for speed
    let chatContext = ''
    try {
      const userId = (session as any)?.user?.id as string | undefined
      if (userId) {
        const recentMessages = await prisma.chatMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5 // Reduced from 10 to 5 for faster queries
        })
        if (recentMessages.length > 0) {
          const contextMessages = recentMessages.reverse().map(m => `${m.role}: ${m.content}`).join('\n')
          chatContext = `\n\nUser's recent conversation context:\n${contextMessages}\n\nUse this context if relevant to tailor the career information.`
        }
      }
    } catch (err) {
      console.error('Error fetching chat history:', err)
    }

    // Try Anthropic first (with web search), then Perplexity as fallback
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY
    const hasPerplexity = !!process.env.PERPLEXITY_API_KEY

    if (hasAnthropic) {
      try {
        const { Anthropic } = await import('@anthropic-ai/sdk')
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

        const prompt = `Provide information about the career "${careerName}" in exactly this format:

DESCRIPTION:
Write 2-3 sentences (max 80 words) covering: main responsibilities, key skills, and education requirements.

INCOME:
Write the 2024-2025 US salary information in this exact format:
Average: $95000
Range: $60000 - $150000

RULES FOR INCOME:
- Use ONLY dollar sign + numbers (like $95000)
- NO commas, NO years, NO text, NO periods
- Example: "$60000 - $150000"

PATHWAY:
List exactly 5-6 concrete steps to pursue this career. Each step should be ONE actionable item.

REQUIREMENTS:
- Plain text only - NO markdown, NO URLs, NO links
- Be clear and concise
- Include specific skills, education, and experience needed${chatContext ? `\n\nContext: ${chatContext}` : ''}`

          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{
              role: 'user',
              content: prompt
            }]
            // NO web search - using model's training data for consistent, reliable output
          })

        const fullResponse = stripMarkdown(message.content.map((block: any) => 
          block.type === 'text' ? block.text : ''
        ).join('\n'))

        console.log(`[Career API - Anthropic response for ${careerName}]`)
        console.log(`[Anthropic] Model: ${message.model}, Stop reason: ${message.stop_reason}, Usage:`, message.usage)
        console.log(`[Anthropic] Response length: ${fullResponse.length} chars`)

        // Helper function to parse URLs from text
        const parseTextWithUrls = (text: string): { text: string; urls: Array<{ text: string; url: string }> } => {
          const urls: Array<{ text: string; url: string }> = []
          let cleanedText = text
          const urlPattern = /([^|]+?)\s*\|\s*(https?:\/\/[^\s\n]+)/gi
          let match
          const matches: Array<{ text: string; url: string; fullMatch: string }> = []
          while ((match = urlPattern.exec(text)) !== null) {
            const linkText = match[1].trim()
            let url = match[2].trim().replace(/[,;.]+$/, '')
            const fullMatch = match[0]
            matches.push({ text: linkText, url, fullMatch })
            urls.push({ text: linkText, url })
          }
          matches.forEach((match) => {
            cleanedText = cleanedText.replace(match.fullMatch, match.text)
          })
          return { text: cleanedText.trim(), urls }
        }

        // Parse the combined response into sections
        const descMatch = fullResponse.match(/DESCRIPTION:?\s*([\s\S]*?)(?=INCOME:|$)/i)
        const incomeMatch = fullResponse.match(/INCOME:?\s*([\s\S]*?)(?=PATHWAY:|$)/i)
        const pathwayMatch = fullResponse.match(/PATHWAY:?\s*([\s\S]*?)$/i)

        // Process description
        if (descMatch) {
          const descriptionText = descMatch[1].trim()
          const parsedDescription = parseTextWithUrls(descriptionText)
          description = parsedDescription.text
          descriptionUrls = parsedDescription.urls
        }

        // Process income
        if (incomeMatch) {
          const incomeText = incomeMatch[1].trim()
          const avgMatch = incomeText.match(/average[:\s]+\$?([\d,]+)/i)
          const rangeMatch = incomeText.match(/range[:\s]+\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/i)
          
          if (avgMatch) {
            let avgStr = avgMatch[1].replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')
            const avgNum = Number(avgStr)
            if (!isNaN(avgNum) && avgNum >= 10000 && avgNum <= 1000000) {
              income.average = `$${avgNum.toLocaleString()}`
            }
          }
          if (rangeMatch) {
            let minStr = rangeMatch[1].replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')
            let maxStr = rangeMatch[2].replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')
            const minNum = Number(minStr)
            const maxNum = Number(maxStr)
            if (!isNaN(minNum) && !isNaN(maxNum) && 
                minNum >= 10000 && minNum <= 1000000 && 
                maxNum >= 10000 && maxNum <= 1000000 &&
                minNum < maxNum) {
              income.range = `$${minNum.toLocaleString()} - $${maxNum.toLocaleString()}`
            }
          }
        }

        // Process pathway
        const pathwayText = pathwayMatch ? pathwayMatch[1].trim() : ''
        const pathwaySteps = pathwayText
          .split(/\n/)
          .filter(line => line.trim().match(/^\d+\.|^[-•]/))
          .map(line => line.replace(/^\d+\.|^[-•]\s*/, '').trim())
          .filter(step => step.length > 0)
          .slice(0, 7)

        pathway = pathwaySteps.map(step => {
          const parsed = parseTextWithUrls(step)
          return parsed.text
        })

        pathwayUrls = pathwaySteps.map(step => {
          const parsed = parseTextWithUrls(step)
          return parsed.urls
        })

        // Cache the AI-generated content in the database (user-specific)
        if (careerNode && userId && description) {
          try {
            const cacheData = {
              description,
              pathway,
              descriptionUrls,
              pathwayUrls,
              income,
              generatedAt: new Date().toISOString()
            }
            
            await prisma.userNodeCache.upsert({
              where: {
                userId_nodeId_cacheType: {
                  userId,
                  nodeId: careerNode.id,
                  cacheType: 'career'
                }
              },
              create: {
                userId,
                nodeId: careerNode.id,
                cacheType: 'career',
                data: cacheData
              },
              update: {
                data: cacheData,
                updatedAt: new Date()
              }
            })
            console.log(`[Career Cache SAVED via Anthropic] User: ${userId}, Career: ${careerName}`)
          } catch (cacheError: any) {
            console.error('Failed to cache career info:', cacheError)
          }
        }
      } catch (error: any) {
        console.error('Anthropic API error:', error?.message || error)
        // Fall through to Perplexity
      }
    }

    // If Anthropic failed or no description, try Perplexity
    if (!description && hasPerplexity) {
      try {
        const perplexity = new OpenAI({
          apiKey: process.env.PERPLEXITY_API_KEY,
          baseURL: 'https://api.perplexity.ai',
        } as any)
        
        // Helper function to parse URLs from text
        const parseTextWithUrls = (text: string): { text: string; urls: Array<{ text: string; url: string }> } => {
          const urls: Array<{ text: string; url: string }> = []
          let cleanedText = text
          
          // Match pattern: "text | https://url.com"
          const urlPattern = /([^|]+?)\s*\|\s*(https?:\/\/[^\s\n]+)/gi
          let match
          const matches: Array<{ text: string; url: string; fullMatch: string }> = []
          
          while ((match = urlPattern.exec(text)) !== null) {
            const linkText = match[1].trim()
            let url = match[2].trim()
            // Clean trailing punctuation from URLs (commas, periods, semicolons)
            url = url.replace(/[,;.]+$/, '')
            const fullMatch = match[0]
            matches.push({ text: linkText, url, fullMatch })
            urls.push({ text: linkText, url })
          }
          
          // Replace matches with just the link text (remove URL part)
          matches.forEach((match) => {
            cleanedText = cleanedText.replace(match.fullMatch, match.text)
          })
          
          return { text: cleanedText.trim(), urls }
        }
        
        // Helper function to create API call with timeout and retry
        const makeApiCallWithTimeout = async (prompt: string, systemPrompt: string, retryCount = 0): Promise<any> => {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('API call timed out after 10 seconds')), 10000)
          })
          
          const apiCall = perplexity.chat.completions.create({
            model: 'sonar-pro',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 2048,
          })
          
          try {
            return await Promise.race([apiCall, timeoutPromise])
          } catch (error: any) {
            // If timeout and we haven't retried yet, retry once
            if (error.message?.includes('timed out') && retryCount === 0) {
              console.log(`Career API call timed out for ${careerName}, retrying...`)
              return makeApiCallWithTimeout(prompt, systemPrompt, 1)
            }
            throw error
          }
        }
        
        // Single combined API call for all information - much faster!
        const combinedPrompt = `Provide information about the career "${careerName}" in exactly this format:

DESCRIPTION:
Write 2-3 sentences (max 80 words) covering: main responsibilities, key skills, and education requirements.

INCOME:
Write the 2024-2025 US salary information in this exact format:
Average: $95000
Range: $60000 - $150000

RULES FOR INCOME:
- Use ONLY dollar sign + numbers (like $95000)
- NO commas, NO years, NO text, NO periods
- Example: "$60000 - $150000"

PATHWAY:
List exactly 5-6 concrete steps to pursue this career. Each step should be ONE actionable item.

REQUIREMENTS:
- Plain text only - NO markdown, NO URLs, NO links
- Be clear and concise
- Include specific skills, education, and experience needed${chatContext ? `\n\nContext: ${chatContext}` : ''}`

        const systemPrompt = 'You are a career advisor. Output plain text only. Do NOT include any URLs or links. Be concise and factual.'
        
        const resp = await makeApiCallWithTimeout(combinedPrompt, systemPrompt)
        
        const fullResponse = stripMarkdown(resp.choices[0]?.message?.content || '')
        
        // Parse the combined response into sections
        const descMatch = fullResponse.match(/DESCRIPTION:?\s*([\s\S]*?)(?=INCOME:|$)/i)
        const incomeMatch = fullResponse.match(/INCOME:?\s*([\s\S]*?)(?=PATHWAY:|$)/i)
        const pathwayMatch = fullResponse.match(/PATHWAY:?\s*([\s\S]*?)$/i)
        
        // Process description
        if (descMatch) {
          const descriptionText = descMatch[1].trim()
          const parsedDescription = parseTextWithUrls(descriptionText)
          description = parsedDescription.text
          descriptionUrls = parsedDescription.urls
        }
        
        // Process income
        if (incomeMatch) {
          const incomeText = incomeMatch[1].trim()
          // Match "Average: $XX,XXX" or "Average: $XXXXX" format
          const avgMatch = incomeText.match(/average[:\s]+\$?([\d,]+)/i)
          // Match "Range: $XX,XXX - $XXX,XXX" format (with various dash types)
          const rangeMatch = incomeText.match(/range[:\s]+\$?([\d,]+)\s*[-–—]\s*\$?([\d,]+)/i)
          
          if (avgMatch) {
            let avgStr = avgMatch[1].replace(/[,\s]/g, '')
            // Remove trailing punctuation
            avgStr = avgStr.replace(/[.,;:]+$/, '')
            // Only accept if it's a valid number between 10k and 1M
            const avgNum = Number(avgStr)
            if (!isNaN(avgNum) && avgNum >= 10000 && avgNum <= 1000000) {
              income.average = `$${avgNum.toLocaleString()}`
            }
          }
          if (rangeMatch) {
            let minStr = rangeMatch[1].replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')
            let maxStr = rangeMatch[2].replace(/[,\s]/g, '').replace(/[.,;:]+$/, '')
            const minNum = Number(minStr)
            const maxNum = Number(maxStr)
            // Only accept if both are valid numbers in reasonable range and min < max
            if (!isNaN(minNum) && !isNaN(maxNum) && 
                minNum >= 10000 && minNum <= 1000000 && 
                maxNum >= 10000 && maxNum <= 1000000 &&
                minNum < maxNum) {
              income.range = `$${minNum.toLocaleString()} - $${maxNum.toLocaleString()}`
            }
          }
        }
        
        // Process pathway
        const pathwayText = pathwayMatch ? pathwayMatch[1].trim() : ''
        
        // Parse pathway into array with URLs
        const pathwaySteps = pathwayText
          .split(/\n/)
          .filter(line => line.trim().match(/^\d+\.|^[-•]/))
          .map(line => line.replace(/^\d+\.|^[-•]\s*/, '').trim())
          .filter(step => step.length > 0)
          .slice(0, 7)
        
        // Parse URLs from each pathway step
        pathway = pathwaySteps.map(step => {
          const parsed = parseTextWithUrls(step)
          return parsed.text
        })
        
        // Collect all URLs from pathway
        pathwayUrls = pathwaySteps.map(step => {
          const parsed = parseTextWithUrls(step)
          return parsed.urls
        })
        
        // Cache the AI-generated content in the database (user-specific)
        if (careerNode && userId) {
          try {
            const cacheData = {
              description,
              pathway,
              descriptionUrls,
              pathwayUrls,
              income,
              generatedAt: new Date().toISOString()
            }
            
            await prisma.userNodeCache.upsert({
              where: {
                userId_nodeId_cacheType: {
                  userId,
                  nodeId: careerNode.id,
                  cacheType: 'career'
                }
              },
              create: {
                userId,
                nodeId: careerNode.id,
                cacheType: 'career',
                data: cacheData
              },
              update: {
                data: cacheData,
                updatedAt: new Date()
              }
            })
            console.log(`[Career Cache SAVED] User: ${userId}, Career: ${careerName}`)
          } catch (cacheError: any) {
            console.error('Failed to cache career info:', cacheError)
            // Don't fail the request if caching fails
          }
        }
        
      } catch (error: any) {
        const isTimeout = error?.message?.includes('timed out')
        console.error(`Perplexity API error${isTimeout ? ' (timeout after retry)' : ''}:`, error?.message || error)
        // Fallback to basic description
        description = `${careerName} is a professional career path. Use web search to find current information about this career.`
        pathway = [
          `Research ${careerName} career requirements`,
          'Join relevant college clubs and organizations',
          'Complete relevant coursework and certifications',
          'Seek internships in the field',
          'Build a portfolio of work',
          'Network with professionals in the industry',
          'Apply for entry-level positions'
        ]
      }
    } else if (!description) {
      // Fallback if no API key
      description = `${careerName} is a professional career path. To get detailed information and current career pathways, please configure the Perplexity API key.`
      pathway = [
        `Research ${careerName} career requirements`,
        'Join relevant college clubs and organizations',
        'Complete relevant coursework and certifications',
        'Seek internships in the field',
        'Build a portfolio of work',
        'Network with professionals in the industry',
        'Apply for entry-level positions'
      ]
    }

    // Ensure we always return valid data
    if (!description || description.trim().length === 0) {
      description = `${careerName} is a professional career path. Use web search to find current information about this career.`
    }
    if (!pathway || pathway.length === 0) {
      pathway = [
        `Research ${careerName} career requirements`,
        'Join relevant college clubs and organizations',
        'Complete relevant coursework and certifications',
        'Seek internships in the field',
        'Build a portfolio of work',
        'Network with professionals in the industry',
        'Apply for entry-level positions'
      ]
    }

    // Indicate reason if we returned fallback-like data
    const looksFallback = (
      typeof description === 'string' && description.includes('professional career path')
    ) || (Array.isArray(pathway) && pathway.length >= 5 && String(pathway[0] || '').includes('Research '))

    return NextResponse.json({ 
      description, 
      pathway, 
      descriptionUrls: descriptionUrls || [], 
      pathwayUrls: pathwayUrls || [], 
      income: income || {}, 
      cached: false,
      reason: looksFallback ? (!process.env.PERPLEXITY_API_KEY ? 'no_api_key' : 'api_error') : undefined
    })
  } catch (error: any) {
    console.error('Career API error:', error)
    // Return fallback data instead of error
    return NextResponse.json({
      description: `${careerName} is a professional career path. Use web search to find current information about this career.`,
      pathway: [
        `Research ${careerName} career requirements`,
        'Join relevant college clubs and organizations',
        'Complete relevant coursework and certifications',
        'Seek internships in the field',
        'Build a portfolio of work',
        'Network with professionals in the industry',
        'Apply for entry-level positions'
      ],
      descriptionUrls: [],
      pathwayUrls: [],
      income: {},
      cached: false,
      error: 'Failed to generate detailed information',
      reason: 'unhandled_exception'
    })
  }
}

