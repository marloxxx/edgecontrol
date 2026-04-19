import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Static first-boot panel users (not read from `.env`).
 * Password is the same for every role until changed in production.
 */
const SEED_EMAIL_DOMAIN = 'ptsi.co.id'
const SEED_PASSWORD = 'ChangeMe123456!'

const SEED_USERS: { role: Role; localPart: string }[] = [
  { role: Role.SUPER_ADMIN, localPart: 'superadmin' },
  { role: Role.ADMIN, localPart: 'admin' },
  { role: 'DEVELOPER' as Role, localPart: 'developer' },
  { role: Role.VIEWER, localPart: 'viewer' }
]

export async function seedRbacUsers(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)

  for (const { role, localPart } of SEED_USERS) {
    const email = `${localPart}@${SEED_EMAIL_DOMAIN}`.toLowerCase()

    await prisma.user.upsert({
      where: { email },
      update: {
        role,
        passwordHash
      },
      create: {
        email,
        passwordHash,
        role
      }
    })
  }

  const summary = SEED_USERS.map(({ role, localPart }) => `${role}:${localPart}@${SEED_EMAIL_DOMAIN}`).join(', ')
  // eslint-disable-next-line no-console -- seed feedback
  console.log(`Seeded RBAC users: ${summary} — password is SEED_PASSWORD in prisma/seeds/rbac.seed.ts`)
}
