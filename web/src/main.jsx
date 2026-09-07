import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ToastProvider } from './components/ui.jsx';

// Révèle les icônes Material Symbols une fois la police chargée (évite le
// flash du texte de ligature « arrow_back », etc.).
const revealIcons = () => document.documentElement.classList.add('ms-ready');
if (document.fonts?.ready) {
  document.fonts.ready.then(() => {
    try {
      if (document.fonts.check('24px "Material Symbols Outlined"')) return revealIcons();
    } catch { /* ignore */ }
    setTimeout(revealIcons, 800);
  });
  setTimeout(revealIcons, 4000);
} else {
  revealIcons();
}

// Service worker (PWA installable + coquille hors-ligne). Actif en build ; en dev
// on le désenregistre pour ne pas gêner le HMR de Vite.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
