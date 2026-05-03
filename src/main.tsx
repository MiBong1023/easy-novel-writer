import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import HomePage from './pages/HomePage'
import NovelPage from './pages/NovelPage'
import EditorPage from './pages/EditorPage'
import StatsPage from './pages/StatsPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/novels/:novelId" element={<NovelPage />} />
        <Route path="/novels/:novelId/episodes/:episodeId" element={<EditorPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
