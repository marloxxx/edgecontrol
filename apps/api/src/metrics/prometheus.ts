import * as client from 'prom-client'

export const metricsRegister = new client.Registry()
client.collectDefaultMetrics({ register: metricsRegister })
