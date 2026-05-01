import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './i18n/index.js'
import './index.css'

// Force page reload when a new service worker takes over so users always get fresh JS
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
