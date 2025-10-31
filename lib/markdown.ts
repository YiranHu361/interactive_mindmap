/**
 * Strips markdown formatting from text and converts it to plain text
 * Removes: **bold**, *italic*, [links](url), # headers, code blocks, etc.
 */
export function stripMarkdown(text: string): string {
  if (!text) return text
  
  // Remove markdown links: [text](url) -> text
  let cleaned = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
  
  // Remove bold/italic: **text** or *text* -> text
  cleaned = cleaned.replace(/\*\*([^\*]+)\*\*/g, '$1')
  cleaned = cleaned.replace(/\*([^\*]+)\*/g, '$1')
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1')
  
  // Remove headers: # Header -> Header
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '')
  
  // Remove code blocks: `code` -> code
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1')
  
  // Remove code fences: ```language\ncode\n``` -> code
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '')
  
  // Remove horizontal rules: --- or ***
  cleaned = cleaned.replace(/^[-*]{3,}$/gm, '')
  
  // Remove blockquotes: > quote -> quote
  cleaned = cleaned.replace(/^>\s+/gm, '')
  
  // Remove list markers at start of line (but keep the content)
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '')
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
  cleaned = cleaned.trim()
  
  return cleaned
}


