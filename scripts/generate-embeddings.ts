/**
 * Script to generate embeddings for all Berkeley courses using OpenAI's text-embedding-3-small
 * 
 * This is a ONE-TIME operation that embeds all course descriptions into vector format
 * for semantic search capabilities.
 * 
 * Usage: tsx scripts/generate-embeddings.ts
 */

import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

async function generateEmbeddings() {
  console.log('🚀 Starting embedding generation for Berkeley courses...\n')

  // First, enable pgvector extension
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
    console.log('✅ pgvector extension enabled\n')
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('✅ pgvector extension already enabled\n')
    } else {
      console.error('❌ Error enabling pgvector:', error.message)
      process.exit(1)
    }
  }

  // Fetch all courses
  const courses = await prisma.berkeley_courses.findMany()
  console.log(`📚 Found ${courses.length} courses to process\n`)

  if (courses.length === 0) {
    console.log('⚠️  No courses found. Make sure you have data in berkeley_courses table.')
    process.exit(0)
  }

  let processedCount = 0
  let errorCount = 0
  let skippedCount = 0

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 20
  const DELAY_MS = 1000 // 1 second delay between batches

  for (let i = 0; i < courses.length; i += BATCH_SIZE) {
    const batch = courses.slice(i, i + BATCH_SIZE)
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(courses.length / BATCH_SIZE)} (${batch.length} courses)`)

    await Promise.all(
      batch.map(async (course) => {
        try {
          // Create text representation of the course
          const courseText = [
            course.subject,
            course.course_number,
            course.course_description || ''
          ].filter(Boolean).join(' ')

          // Skip if no meaningful text
          if (courseText.trim().length < 10) {
            console.log(`⏭️  Skipping ${course.subject} ${course.course_number} (insufficient text)`)
            skippedCount++
            return
          }

          // Generate embedding
          const response = await (openai as any).embeddings.create({
            model: 'text-embedding-3-small',
            input: courseText,
            dimensions: 1536 // Standard dimension for compatibility
          })

          const embedding = response.data[0].embedding

          // Update database with vector
          await prisma.$executeRaw`
            UPDATE berkeley_courses 
            SET embedding = ${JSON.stringify(embedding)}::vector
            WHERE subject = ${course.subject} 
              AND course_number = ${course.course_number}
          `

          processedCount++
          console.log(`✅ ${course.subject} ${course.course_number}`)

        } catch (error: any) {
          errorCount++
          console.error(`❌ Error processing ${course.subject} ${course.course_number}:`, error.message)
        }
      })
    )

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < courses.length) {
      console.log(`⏳ Waiting ${DELAY_MS}ms before next batch...`)
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Embedding Generation Complete!')
  console.log('='.repeat(60))
  console.log(`✅ Successfully processed: ${processedCount}`)
  console.log(`⏭️  Skipped: ${skippedCount}`)
  console.log(`❌ Errors: ${errorCount}`)
  console.log(`📈 Total: ${courses.length}`)
  console.log('='.repeat(60))
}

async function main() {
  try {
    await generateEmbeddings()
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

