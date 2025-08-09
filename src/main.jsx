import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Not using React.StrictMode here to avoid double-invoking effects that
// can make timers/toasts feel weird during development.
createRoot(document.getElementById('root')).render(<App />)
