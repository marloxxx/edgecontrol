import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from '../app.module'

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule)
  // Keep process alive while worker provider handles queue jobs.
  process.on('SIGTERM', async () => {
    await app.close()
    process.exit(0)
  })
}

void bootstrapWorker().catch((err) => {
  console.error('[edgecontrol-worker] Bootstrap failed:', err)
  process.exit(1)
})
