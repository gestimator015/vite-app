import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './supabase.js'
import './index.css'
import App from './App.jsx'
import Auth from './Auth.jsx'
import GuestJoin from './GuestJoin.jsx'

function SetNewPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm)  { setError('Passwords do not match'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Password updated! Signing you in…')
    setTimeout(onDone, 1500)
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '12px 16px', color: '#fff', fontSize: 14, boxSizing: 'border-box', outline: 'none' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0f19' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '0 24px' }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Set new password</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Choose a strong password for your account.</p>
        <form onSubmit={handleSubmit}>
          <input type="password" placeholder="New password (min. 8 characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={{ ...inp, marginBottom: 12 }} />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ ...inp, marginBottom: 20 }} />
          {error   && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          {success && <p style={{ color: '#34d399', fontSize: 13, marginBottom: 12 }}>{success}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

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
