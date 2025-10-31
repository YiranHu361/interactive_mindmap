import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const careers = [
  'Software Engineer','Data Scientist','Product Manager','UX Designer','Investment Analyst',
  'Marketing Manager','Sales Engineer','Cybersecurity Analyst','DevOps Engineer','Quant Researcher',
  'Mechanical Engineer','Bioinformatics Scientist','Policy Analyst','Teacher','Entrepreneur'
]

// Define skills that connect to multiple careers (many-to-many)
const skillToCareers: Record<string, string[]> = {
  'Python': ['Software Engineer', 'Data Scientist', 'DevOps Engineer', 'Quant Researcher', 'Bioinformatics Scientist'],
  'JavaScript': ['Software Engineer', 'UX Designer', 'Product Manager'],
  'SQL': ['Data Scientist', 'Investment Analyst', 'Product Manager'],
  'Communication': ['Marketing Manager', 'Sales Engineer', 'Teacher', 'Product Manager'],
  'Project Management': ['Product Manager', 'Entrepreneur', 'DevOps Engineer'],
  'Data Analysis': ['Data Scientist', 'Investment Analyst', 'Policy Analyst'],
  'Machine Learning': ['Data Scientist', 'Bioinformatics Scientist', 'Quant Researcher'],
  'UI/UX Design': ['UX Designer', 'Product Manager', 'Software Engineer'],
  'Statistics': ['Data Scientist', 'Investment Analyst', 'Policy Analyst', 'Bioinformatics Scientist'],
  'Analytics': ['Data Scientist', 'Product Manager', 'Marketing Manager'],
  'Testing': ['Software Engineer', 'Product Manager'],
  'System Design': ['Software Engineer', 'DevOps Engineer'],
  'Git': ['Software Engineer', 'DevOps Engineer'],
  'TypeScript': ['Software Engineer', 'UX Designer'],
  'Cloud': ['DevOps Engineer', 'Software Engineer', 'Data Scientist'],
  'Linux': ['DevOps Engineer', 'Software Engineer', 'Cybersecurity Analyst'],
  'CI/CD': ['DevOps Engineer', 'Software Engineer'],
  'Excel': ['Investment Analyst', 'Data Scientist', 'Product Manager'],
  'Presentation': ['Investment Analyst', 'Product Manager', 'Marketing Manager', 'Sales Engineer'],
  'Research': ['Data Scientist', 'Policy Analyst', 'Bioinformatics Scientist'],
  'Economics': ['Investment Analyst', 'Policy Analyst'],
  'Finance': ['Investment Analyst', 'Entrepreneur'],
}

const pathways: Record<string, string[]> = {
  'Software Engineer': [
    'Join the CS club and attend hackathons.',
    'Complete data structures and algorithms coursework.',
    'Build two substantial projects (web/app/backend).',
    'Intern at a software company; seek code reviews.',
    'Apply to new grad roles; practice interviews weekly.'
  ],
  'Data Scientist': [
    'Take stats + ML courses and lead a Kaggle project.',
    'Volunteer as a data analyst for a campus org.',
    'Intern in analytics or research; ship dashboards.',
    'Publish a portfolio with notebooks and insights.'
  ],
}

async function main() {
  // Core center node
  await prisma.node.upsert({
    where: { id: 'career' },
    update: {},
    create: { id: 'career', type: 'career', label: 'career', summary: 'Explore careers at the center of the map.' },
  })

  // Create all career nodes
  for (const career of careers) {
    await prisma.node.upsert({
      where: { id: career },
      update: {},
      create: {
        id: career,
        type: 'career',
        label: career,
        summary: `${career} and related skills`,
        metadata: { pathway: pathways[career] || [] },
      },
    })

    // Connect careers to center
    await prisma.edge.upsert({
      where: { id: `${'career'}_${career}` },
      update: {},
      create: { id: `${'career'}_${career}`, sourceId: 'career', targetId: career, weight: 1 },
    })
  }

  // Create skills and connect them to multiple careers (many-to-many)
  for (const [skill, careerList] of Object.entries(skillToCareers)) {
    // Create skill node (use skill name as ID, not prefixed with career)
      await prisma.node.upsert({
      where: { id: skill },
        update: {},
      create: { id: skill, type: 'skill', label: skill },
      })

    // Create edges connecting this skill to all its careers
    for (const career of careerList) {
      // Only create edge if career exists
      if (careers.includes(career)) {
      await prisma.edge.upsert({
          where: { id: `${skill}_${career}` },
        update: {},
          create: { id: `${skill}_${career}`, sourceId: skill, targetId: career, weight: 1 },
      })
      }
    }
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })


