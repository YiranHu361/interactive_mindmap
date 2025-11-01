/**
 * Script to generate embeddings for all Berkeley organizations using OpenAI's text-embedding-3-small
 * 
 * This is a ONE-TIME operation that embeds all organization descriptions into vector format
 * for semantic search capabilities.
 * 
 * Usage: tsx scripts/generate-org-embeddings.ts
 */

import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

async function generateEmbeddings() {
  console.log('🚀 Starting embedding generation for Berkeley organizations...\n')

  // Fetch all organizations
  const orgs = await prisma.berkeley_organizations.findMany()
  console.log(`📚 Found ${orgs.length} organizations to process\n`)

  if (orgs.length === 0) {
    console.log('⚠️  No organizations found. Make sure you have data in berkeley_organizations table.')
    process.exit(0)
  }

  let processedCount = 0
  let errorCount = 0
  let skippedCount = 0

  // Process in batches to avoid rate limits
  const BATCH_SIZE = 20
  const DELAY_MS = 1000 // 1 second delay between batches

  for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
    const batch = orgs.slice(i, i + BATCH_SIZE)
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(orgs.length / BATCH_SIZE)} (${batch.length} organizations)`)

    await Promise.all(
      batch.map(async (org) => {
        try {
          // Create text representation of the organization
          const orgText = [
            org.name,
            org.description || ''
          ].filter(Boolean).join(' ')

          // Skip if no meaningful text
          if (orgText.trim().length < 10) {
            console.log(`⏭️  Skipping ${org.name.substring(0, 50)} (insufficient text)`)
            skippedCount++
            return
          }

          // Generate embedding
          const response = await (openai as any).embeddings.create({
            model: 'text-embedding-3-small',
            input: orgText,
            dimensions: 1536 // Standard dimension for compatibility
          })

          const embedding = response.data[0].embedding

          // Update database with vector
          await prisma.$executeRaw`
            UPDATE berkeley_organizations 
            SET embedding = ${JSON.stringify(embedding)}::vector
            WHERE name = ${org.name}
          `

          processedCount++
          console.log(`✅ ${org.name.substring(0, 60)}`)

        } catch (error: any) {
          errorCount++
          console.error(`❌ Error processing ${org.name.substring(0, 50)}:`, error.message)
        }
      })
    )

    // Delay between batches to respect rate limits
    if (i + BATCH_SIZE < orgs.length) {
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
  console.log(`📈 Total: ${orgs.length}`)
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

