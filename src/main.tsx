import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
  replaysOnErrorSampleRate: 1.0,
})
import HomePage from './pages/HomePage'
import NovelPage from './pages/NovelPage'
import EditorPage from './pages/EditorPage'
import StatsPage from './pages/StatsPage'
import SharePage from './pages/SharePage'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/novels/:novelId" element={<NovelPage />} />
          <Route path="/novels/:novelId/episodes/:episodeId" element={<EditorPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/share/:shareId" element={<SharePage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
