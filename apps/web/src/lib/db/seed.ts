import { db } from './index'
import { sessions } from './schema'

async function seed() {
  console.log('Seeding database...')
  
  // Create sample sessions
  const sampleSessions = [
    {
      id: 'claude-1',
      name: 'claude-pr-123',
      type: 'claude' as const,
      workdir: '/Users/frand/projects/project-1',
      socketPath: '/tmp/terminal-nexus/claude-1.sock',
      command: 'claude',
      flags: JSON.stringify(['--yolo', '--full-auto']),
      pid: 12345,
      status: 'running' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'droid-1',
      name: 'droid-testing',
      type: 'droid' as const,
      workdir: '/Users/frand/projects/project-2',
      socketPath: '/tmp/terminal-nexus/droid-1.sock',
      command: 'droid',
      flags: JSON.stringify([]),
      pid: 12346,
      status: 'running' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  for (const session of sampleSessions) {
    await db.insert(sessions).values(session).onConflictDoNothing()
  }

  console.log('Database seeded!')
}

seed().catch(console.error)
