import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deduplicateSkills() {
  try {
    // Get all skill nodes
    const allSkills = await prisma.node.findMany({
      where: { type: 'skill' }
    })

    console.log(`Total skills before: ${allSkills.length}`)

    // Group skills by label
    const skillsByLabel: Record<string, typeof allSkills> = {}
    for (const skill of allSkills) {
      if (!skillsByLabel[skill.label]) {
        skillsByLabel[skill.label] = []
      }
      skillsByLabel[skill.label].push(skill)
    }

    // Find duplicates
    const duplicates = Object.entries(skillsByLabel).filter(([_, skills]) => skills.length > 1)
    console.log(`\nFound ${duplicates.length} skills with duplicates:`)
    
    for (const [label, skills] of duplicates) {
      console.log(`\n${label}: ${skills.length} instances`)
      skills.forEach(s => console.log(`  - ${s.id}`))
      
      // Keep career-specific ones (format: "Career_Skill"), delete standalone ones
      const standalone = skills.filter(s => !s.id.includes('_'))
      const careerSpecific = skills.filter(s => s.id.includes('_'))
      
      if (standalone.length > 0 && careerSpecific.length > 0) {
        console.log(`  Will delete standalone: ${standalone.map(s => s.id).join(', ')}`)
        
        for (const skill of standalone) {
          // Delete edges connected to this skill
          await prisma.edge.deleteMany({
            where: {
              OR: [
                { sourceId: skill.id },
                { targetId: skill.id }
              ]
            }
          })
          
          // Delete user cache for this skill
          await prisma.userNodeCache.deleteMany({
            where: { nodeId: skill.id }
          })
          
          // Delete the node
          await prisma.node.delete({
            where: { id: skill.id }
          })
          
          console.log(`  ✓ Deleted ${skill.id}`)
        }
      }
    }

    // Verify all career-specific skills link to their careers
    const remainingSkills = await prisma.node.findMany({
      where: { type: 'skill' }
    })

    console.log(`\n\nVerifying edges for ${remainingSkills.length} remaining skills...`)
    let fixed = 0

    for (const skill of remainingSkills) {
      // Extract career from skill ID (format: "Career_Skill")
      if (skill.id.includes('_')) {
        const careerName = skill.id.split('_')[0]
        
        // Check if edge exists from career to this skill
        const existingEdge = await prisma.edge.findFirst({
          where: {
            sourceId: careerName,
            targetId: skill.id
          }
        })

        if (!existingEdge) {
          // Create the edge
          await prisma.edge.create({
            data: {
              id: `${skill.id}_edge`,
              sourceId: careerName,
              targetId: skill.id,
              weight: 1
            }
          })
          console.log(`  ✓ Created edge: ${careerName} -> ${skill.id}`)
          fixed++
        }
      }
    }

    console.log(`\nFixed ${fixed} missing edges`)
    
    const finalSkills = await prisma.node.findMany({
      where: { type: 'skill' }
    })
    console.log(`\nTotal skills after: ${finalSkills.length}`)
    console.log(`Removed: ${allSkills.length - finalSkills.length} duplicate skills`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deduplicateSkills()


