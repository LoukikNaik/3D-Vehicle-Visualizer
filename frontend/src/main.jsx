import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './api/AuthContext'
import { AuthShell } from './api/AuthShell'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AuthShell />
    </AuthProvider>
  </React.StrictMode>,
)
