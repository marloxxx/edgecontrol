import { Injectable } from '@nestjs/common'

import { env } from './env'

@Injectable()
export class AppConfigService {
  get values() {
    return env
  }
}
