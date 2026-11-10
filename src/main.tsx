import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/poppins/latin-800.css';
import '@fontsource/poppins/latin-900.css';
import '@fontsource/poppins/latin-800-italic.css';
import '@fontsource/poppins/latin-900-italic.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles/global.css';

const Home = lazy(() => import('./pages/Home'));
const ParticipantPage = lazy(() => import('./pages/ParticipantPage'));
const StagePage = lazy(() => import('./pages/StagePage'));
const ControlPage = lazy(() => import('./pages/ControlPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Loading() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/participar/:sessionId" element={<ParticipantPage />} />
          <Route path="/palco/:sessionId" element={<StagePage />} />
          <Route path="/controle/:sessionId" element={<ControlPage />} />
          <Route path="/demo" element={<DemoPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
