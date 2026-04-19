import { config as loadDotenv } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Monorepo root `.env` (same file as Docker Compose / setup). From `packages/db/prisma/seeds` → four levels up.
const __dirname = dirname(fileURLToPath(import.meta.url))
loadDotenv({ path: resolve(__dirname, '../../../../.env') })

interface RbacSeedUser {
  role: Role
  email: string
  password: string
}

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

function seedBaseDomain(): string {
  const d = env.BASE_DOMAIN?.trim()
  return d && d.length > 0 ? d : 'ptsi.co.id'
}

function nonEmpty(s: string | undefined): string | undefined {
  const t = s?.trim()
  return t ? t : undefined
}

function getSeedUsers(): RbacSeedUser[] {
  const d = seedBaseDomain()
  const DEFAULT_SEED_PASSWORD = nonEmpty(env.RBAC_SEED_PASSWORD) ?? 'ChangeMe123456!'

  const pickEmail = (explicit: string | undefined, adminFallback: string | undefined, local: string) => {
    return nonEmpty(explicit) ?? nonEmpty(adminFallback) ?? `${local}@${d}`
  }

  const pickPassword = (...vals: (string | undefined)[]) =>
    vals.map(nonEmpty).find(Boolean) ?? DEFAULT_SEED_PASSWORD

  return [
    {
      role: Role.SUPER_ADMIN,
      email: pickEmail(env.RBAC_SUPER_ADMIN_EMAIL, env.ADMIN_EMAIL, 'superadmin'),
      password: pickPassword(env.RBAC_SUPER_ADMIN_PASSWORD, env.ADMIN_PASSWORD)
    },
    {
      role: Role.ADMIN,
      email: pickEmail(env.RBAC_ADMIN_EMAIL, undefined, 'admin'),
      password: pickPassword(env.RBAC_ADMIN_PASSWORD)
    },
    {
      role: 'DEVELOPER' as Role,
      email: pickEmail(env.RBAC_DEVELOPER_EMAIL, undefined, 'developer'),
      password: pickPassword(env.RBAC_DEVELOPER_PASSWORD)
    },
    {
      role: Role.VIEWER,
      email: pickEmail(env.RBAC_VIEWER_EMAIL, undefined, 'viewer'),
      password: pickPassword(env.RBAC_VIEWER_PASSWORD)
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
