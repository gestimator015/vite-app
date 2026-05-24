import { useState } from 'react'
import { supabase } from './supabase.js'
import { THEME } from './theme.js'

export default function Auth() {
  const [mode, setMode]                   = useState('signin')
  const [fullName, setFullName]           = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')
  const [loading, setLoading]             = useState(false)

  const isRegister = mode === 'register'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        })
        if (error) {
          setError(error.message)
        } else {
          setSuccess('Check your email to confirm your account')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) setError('Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: THEME.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: THEME.bgCard, border: `1px solid ${THEME.borderCard}`,
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 8px 40px rgba(15,110,86,.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            fontFamily: "'Syne','Segoe UI',sans-serif", fontWeight: 800,
            fontSize: 24, color: THEME.primary, letterSpacing: '.3px',
          }}>MeetHub</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 28, borderBottom: `1px solid ${THEME.border}` }}>
          {[['signin', 'Sign in'], ['register', 'Create account']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setMode(key); setError(''); setSuccess(''); }}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 0', fontSize: 14, fontWeight: 600,
                color: mode === key ? THEME.primary : THEME.textMuted,
                borderBottom: mode === key ? `2px solid ${THEME.primary}` : '2px solid transparent',
                marginBottom: -1, transition: 'color .15s',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                required
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: isRegister ? 16 : 24 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              style={inputStyle}
            />
          </div>

          {isRegister && (
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                style={inputStyle}
              />
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
              borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 16,
            }}>{error}</div>
          )}

          {success && (
            <div style={{
              background: 'rgba(15,110,86,.08)', border: '1px solid rgba(15,110,86,.2)',
              borderRadius: 9, padding: '10px 14px', fontSize: 13, color: THEME.primary, marginBottom: 16,
            }}>{success}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', background: THEME.primary, color: '#fff',
              border: 'none', borderRadius: 12, padding: '13px 0',
              fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? (isRegister ? 'Creating account…' : 'Signing in…')
              : (isRegister ? 'Create account' : 'Sign in')}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: THEME.textMuted, textTransform: 'uppercase',
  letterSpacing: '.07em', marginBottom: 7,
}

const inputStyle = {
  width: '100%', background: THEME.bgInput,
  border: `1px solid ${THEME.border}`,
  borderRadius: 10, padding: '10px 14px',
  color: THEME.textMain, fontSize: 14,
  boxSizing: 'border-box',
}
