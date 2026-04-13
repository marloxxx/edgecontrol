/**
 * Server-only entry: imports @trpc/server via ./router. Do not import from the web bundle.
 */
export { createAppRouter } from './router'
export type { AppRouter, AppRouterDeps, RouterContext } from './router'
