import { PrismaClient } from '@prisma/client'

import { seedRbacUsers } from './seeds/rbac.seed'

const prisma = new PrismaClient()

async function main() {
  await seedRbacUsers(prisma)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
