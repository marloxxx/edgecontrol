import { Injectable, Logger } from '@nestjs/common'

import { env } from '../../config/env'

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name)

  async sendMessage(message: string) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      this.logger.warn('Telegram not configured, skipping message')
      return
    }

    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`

    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message
      })
    })
  }
}
