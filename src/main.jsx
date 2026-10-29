import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Debug from './Debug.jsx'
import './styles/tokens.css'
import './styles/bundle.css'
import './styles/app.css'

const debug = new URLSearchParams(location.search).has('debug')
createRoot(document.getElementById('root')).render(<StrictMode>{debug ? <Debug /> : <App />}</StrictMode>)
