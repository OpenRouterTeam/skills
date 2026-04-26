import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './styles/globals.css';

// Self-hosted variable fonts — no external CDN calls.
import '@fontsource-variable/fraunces/index.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/inter-tight/index.css';
import '@fontsource-variable/jetbrains-mono/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
