import { PrismaClient } from '@prisma/client'

import { seedRbacUsers } from './seeds/rbac.seed'

const prisma = new PrismaClient()

async function main() {
  await seedRbacUsers(prisma)

  await prisma.node.upsert({
    where: { name: 'Example app VPS' },
    create: {
      name: 'Example app VPS',
      host: '10.0.0.3',
      region: 'private-network'
    },
    update: {}
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
