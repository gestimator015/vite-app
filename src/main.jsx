import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './supabase.js'
import './index.css'
import App from './App.jsx'
import Auth from './Auth.jsx'
import GuestJoin from './GuestJoin.jsx'

function Root() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  if (!session) return <Auth />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/join/:roomId" element={<GuestJoin />} />
        <Route path="/*" element={<App user={session.user} />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
