import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

interface RbacSeedUser {
  role: Role
  email: string
  password: string
}

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

const DEFAULT_SEED_PASSWORD = env.RBAC_SEED_PASSWORD ?? 'ChangeMe123456!'

function getSeedUsers(): RbacSeedUser[] {
  return [
    {
      role: Role.SUPER_ADMIN,
      email: env.RBAC_SUPER_ADMIN_EMAIL ?? env.ADMIN_EMAIL ?? 'superadmin@edgecontrol.local',
      password: env.RBAC_SUPER_ADMIN_PASSWORD ?? env.ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD
    },
    {
      role: Role.ADMIN,
      email: env.RBAC_ADMIN_EMAIL ?? 'admin@edgecontrol.local',
      password: env.RBAC_ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD
    },
    {
      role: 'DEVELOPER' as Role,
      email: env.RBAC_DEVELOPER_EMAIL ?? 'developer@edgecontrol.local',
      password: env.RBAC_DEVELOPER_PASSWORD ?? DEFAULT_SEED_PASSWORD
    },
    {
      role: Role.VIEWER,
      email: env.RBAC_VIEWER_EMAIL ?? 'viewer@edgecontrol.local',
      password: env.RBAC_VIEWER_PASSWORD ?? DEFAULT_SEED_PASSWORD
    }
  ]
}

export async function seedRbacUsers(prisma: PrismaClient) {
  const users = getSeedUsers()

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12)

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        role: user.role,
        passwordHash
      },
      create: {
        email: user.email,
        passwordHash,
        role: user.role
      }
    })
  }

  // eslint-disable-next-line no-console -- seed feedback
  console.log(
    `Seeded RBAC users: ${users.map((user) => `${user.role}:${user.email}`).join(', ')}`
  )
}
