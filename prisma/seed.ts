import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const careers = [
  'Software Engineer','Data Scientist','Product Manager','UX Designer','Investment Analyst',
  'Marketing Manager','Sales Engineer','Cybersecurity Analyst','DevOps Engineer','Quant Researcher',
  'Mechanical Engineer','Bioinformatics Scientist','Policy Analyst','Teacher','Entrepreneur'
]

const skillMap: Record<string, string[]> = {
  'Software Engineer': ['Algorithms','Data Structures','JavaScript','TypeScript','Git','Testing','System Design','Databases'],
  'Data Scientist': ['Python','Statistics','Machine Learning','SQL','Data Visualization','Pandas','Experiment Design'],
  'Product Manager': ['Roadmapping','User Research','Prioritization','Communication','Analytics','A/B Testing'],
  'UX Designer': ['Figma','User Interviews','Wireframing','Prototyping','Accessibility','Design Systems'],
  'Investment Analyst': ['Financial Modeling','Excel','Valuation','Accounting','Market Research','Presentation'],
  'Marketing Manager': ['SEO','Content Strategy','Analytics','Copywriting','Campaigns','Social Media'],
  'Sales Engineer': ['Pre-Sales','Demos','Solutions','Communication','APIs','CRM'],
  'Cybersecurity Analyst': ['Threat Modeling','Network Security','SIEM','Incident Response','Scripting','Risk'],
  'DevOps Engineer': ['Linux','CI/CD','Containers','Kubernetes','Cloud','Monitoring'],
  'Quant Researcher': ['Probability','Stochastic Calculus','Python','C++','Backtesting','Time Series'],
  'Mechanical Engineer': ['CAD','Statics','Dynamics','Manufacturing','Materials','MATLAB'],
  'Bioinformatics Scientist': ['Biology','Genomics','R','Python','Statistics','Pipelines'],
  'Policy Analyst': ['Policy Writing','Economics','Statistics','Research','Stakeholder Analysis'],
  'Teacher': ['Classroom Management','Curriculum','Assessment','Communication','Subject Mastery'],
  'Entrepreneur': ['Fundraising','MVP','Go-To-Market','Pitching','Hiring','Finance']
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

    await prisma.edge.upsert({
      where: { id: `${'career'}_${career}` },
      update: {},
      create: { id: `${'career'}_${career}`, sourceId: 'career', targetId: career, weight: 1 },
    })

    for (const skill of skillMap[career] || []) {
      await prisma.node.upsert({
        where: { id: `${career}_${skill}` },
        update: {},
        create: { id: `${career}_${skill}`, type: 'skill', label: skill },
      })
      await prisma.edge.upsert({
        where: { id: `${career}_${skill}_edge` },
        update: {},
        create: { id: `${career}_${skill}_edge`, sourceId: career, targetId: `${career}_${skill}`, weight: 1 },
      })
    }
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })


