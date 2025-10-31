import { prisma } from '../lib/prisma'

async function clearCache() {
  try {
    console.log('Fetching all nodes...')
    const nodes = await prisma.node.findMany()
    
    console.log(`Found ${nodes.length} nodes. Clearing cache...`)
    
    let clearedCount = 0
    for (const node of nodes) {
      const metadata = node.metadata as any || {}
      
      // Check if node has any cached AI data
      const hasCareerCache = metadata.aiDescription || metadata.aiPathway || metadata.aiIncome
      const hasSkillCache = Object.keys(metadata).some(key => key.startsWith('aiLearning'))
      
      if (hasCareerCache || hasSkillCache) {
        // Create new metadata without AI cache fields
        const newMetadata: any = {}
        
        // Keep non-AI fields if any exist
        Object.keys(metadata).forEach(key => {
          if (!key.startsWith('ai')) {
            newMetadata[key] = metadata[key]
          }
        })
        
        await prisma.node.update({
          where: { id: node.id },
          data: {
            metadata: Object.keys(newMetadata).length > 0 ? newMetadata : null
          }
        })
        
        clearedCount++
        console.log(`Cleared cache for node: ${node.label} (${node.type})`)
      }
    }
    
    console.log(`\n✅ Cache cleared successfully!`)
    console.log(`   - Total nodes: ${nodes.length}`)
    console.log(`   - Nodes with cache cleared: ${clearedCount}`)
    console.log(`   - Nodes without cache: ${nodes.length - clearedCount}`)
  } catch (error) {
    console.error('Error clearing cache:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

clearCache()


