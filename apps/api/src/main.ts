import 'reflect-metadata'

import cors from 'cors'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'
import { AuthService } from './auth/auth.service'
import { env } from './config/env'
import { buildAppRouter } from './trpc/trpc.router'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
      credentials: false
    })
  )

  const appRouter = buildAppRouter(app)
  const authService = app.get(AuthService)

  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: async ({ req }) => {
        const header = req.headers.authorization
        if (typeof header === 'string' && header.startsWith('Bearer ')) {
          const token = header.slice(7).trim()
          if (token) {
            try {
              const user = authService.verifyAccessToken(token)
              return { user }
            } catch {
              return {}
            }
          }
        }
        return {}
      }
    })
  )

  await app.listen(env.API_PORT)
}

void bootstrap()
