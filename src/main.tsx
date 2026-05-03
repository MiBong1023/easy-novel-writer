import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import NovelPage from './pages/NovelPage'
import EditorPage from './pages/EditorPage'
import StatsPage from './pages/StatsPage'

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
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
