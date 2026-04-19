import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { normalizeRole } from '@edgecontrol/trpc'

import { LOGIN_RATE_LIMIT_PER_MINUTE } from '@edgecontrol/config'

import { env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'

const RATE_WINDOW_MS = 60_000

interface AccessTokenPayload {
  sub: string
  email: string
  role: string
}

@Injectable()
export class AuthService {
  private readonly loginAttemptTracker = new Map<string, number[]>()

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async login(email: string, password: string) {
    this.enforceRateLimit(email)

    const user = await this.prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const matches = await bcrypt.compare(password, user.passwordHash)
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    )

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    }
  }

  async me(ctx: { user?: { id: string; email: string; role: string } } | undefined) {
    const user = ctx?.user
    if (!user) return null
    return {
      ...user,
      role: normalizeRole(user.role)
    }
  }

  /**
   * Verifies a JWT access token and returns the authenticated user payload.
   */
  verifyAccessToken(token: string): { id: string; email: string; role: string } {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & AccessTokenPayload
      const id = decoded.sub
      const email = decoded.email
      const role = decoded.role
      if (typeof id !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
        throw new UnauthorizedException('Invalid token payload')
      }
      return { id, email, role: normalizeRole(role) }
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }

  private enforceRateLimit(email: string) {
    const now = Date.now()
    const timestamps = this.loginAttemptTracker.get(email) ?? []
    const filtered = timestamps.filter((value) => now - value < RATE_WINDOW_MS)

    if (filtered.length >= LOGIN_RATE_LIMIT_PER_MINUTE) {
      throw new UnauthorizedException('Too many login attempts. Try again later.')
    }

    filtered.push(now)
    this.loginAttemptTracker.set(email, filtered)
  }
}
