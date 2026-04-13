import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/app/globals.css'

import { AppProviders } from '@/src/app/app-providers'
import { AppRouter } from '@/src/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>
)
