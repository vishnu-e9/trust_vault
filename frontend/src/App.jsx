import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './Dashboard.jsx'

const API_BASE = import.meta.env.VITE_API_URL || ''

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email || ''
  const [local, domain] = email.split('@')
  if (local.length <= 2) {
    return `${local[0]}*@${domain}`
  }
  return `${local[0]}${'*'.repeat(Math.max(local.length - 2, 3))}${local[local.length - 1]}@${domain}`
}

function App() {
  // Modes: 'login' | 'register' | 'forgot' | 'mfa' | 'reset'
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Multi-Factor Authentication states
  const [mfaCode, setMfaCode] = useState('')
  const [mfaTempToken, setMfaTempToken] = useState('')
  const [mfaEmail, setMfaEmail] = useState('')
  const [mfaEvalCode, setMfaEvalCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Password reset token state
  const [resetToken, setResetToken] = useState('')
  const [resetTokenEmail, setResetTokenEmail] = useState('')
  const [evalResetUrl, setEvalResetUrl] = useState('')
  const [evalResetToken, setEvalResetToken] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [loggedInUser, setLoggedInUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('trustvault_user') || 'null')
    } catch {
      return null
    }
  })

  // Detect resetToken in URL query params or hash on page load and URL changes
  useEffect(() => {
    const checkResetToken = () => {
      const params = new URLSearchParams(window.location.search)
      let token = params.get('resetToken')
      if (!token && window.location.hash.includes('resetToken=')) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''))
        token = hashParams.get('resetToken')
      }

      if (token && token.trim()) {
        const cleanToken = token.trim()
        sessionStorage.removeItem('trustvault_token')
        sessionStorage.removeItem('trustvault_user')
        setLoggedInUser(null)
        setResetToken(cleanToken)
        setMode('reset')
        setError('')
        setMessage('Verifying reset link...')
        verifyResetToken(cleanToken)
      }
    }

    checkResetToken()
    window.addEventListener('popstate', checkResetToken)
    return () => window.removeEventListener('popstate', checkResetToken)
  }, [])

  // Cooldown timer for MFA resend
  useEffect(() => {
    let timer
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Verify reset token with backend
  async function verifyResetToken(token) {
    try {
      const clean = (token || '').trim()
      const res = await fetch(`${API_BASE}/api/auth/verify-reset-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: clean }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetTokenEmail(data.email || '')
        setMessage('Reset link verified. Please enter your new password.')
      } else {
        setError(data.message || 'Password reset link is invalid or expired.')
      }
    } catch {
      setError('Could not verify reset link. Please check your connection.')
    }
  }

    // Verify 6-digit MFA verification code (callable by form or instant autofill)
  async function verifyMfaCode(rawCode) {
    const code = (rawCode || mfaCode || '').trim()
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: mfaTempToken, mfaCode: code }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired verification code.')
      }

      if (!data.token || !data.user) {
        throw new Error('Authentication response was incomplete.')
      }

      sessionStorage.setItem('trustvault_token', data.token)
      sessionStorage.setItem('trustvault_user', JSON.stringify(data.user))
      setLoggedInUser(data.user)
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Form Submission
  async function handleSubmit(event) {
    event.preventDefault()
    setMessage('')
    setError('')

    // 1. FORGOT PASSWORD (Send reset link to registered email)
    if (mode === 'forgot') {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid registered email address.')
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Could not send reset link.')
        }

        if (data.resetUrl) {
          setEvalResetUrl(data.resetUrl)
          setEvalResetToken(data.resetToken || '')
        } else {
          setEvalResetUrl('')
          setEvalResetToken('')
        }
        setMessage(
          data.message || `A password reset link has been sent to ${email.trim()}.`
        )
      } catch (err) {
        setError(err.message || 'Failed to dispatch password reset link.')
      } finally {
        setLoading(false)
      }
      return
    }

    // 2. SET NEW PASSWORD (Via verified reset token)
    if (mode === 'reset') {
      if (password.length < 8) {
        setError('Password must contain at least 8 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resetToken, password }),
        })
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Failed to reset password.')
        }

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
        setMessage('Password reset successfully! You can now sign in with your new password.')
        setMode('login')
        setPassword('')
        setConfirmPassword('')
        setResetToken('')
      } catch (err) {
        setError(err.message || 'Failed to reset password.')
      } finally {
        setLoading(false)
      }
      return
    }

    // 3. MULTI-FACTOR AUTHENTICATION (Verify 6-digit OTP code)
    if (mode === 'mfa') {
      await verifyMfaCode()
      return
    }

    // 4. REGISTRATION / INITIAL LOGIN
    if (mode === 'register' && password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { email: email.trim(), password }
            : { name: name.trim(), email: email.trim(), password }
        ),
      })

      const responseText = await response.text()
      let data = {}
      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          throw new Error(`Server returned invalid response (HTTP ${response.status}).`)
        }
      }

      if (!response.ok) {
        throw new Error(data.message || `Request failed (HTTP ${response.status}).`)
      }

      if (mode === 'register') {
        setMessage('Account created successfully. You can now sign in.')
        setMode('login')
        setPassword('')
      } else {
        // Check if 2FA / MFA is required
        if (data.mfaRequired) {
          setMfaTempToken(data.tempToken)
          setMfaEmail(data.email)
          setMfaCode('')
          setMode('mfa')
          if (data.evalCode) {
            setMfaEvalCode(data.evalCode)
          } else {
            setMfaEvalCode('')
          }
          setMessage(
            data.evalCode
              ? 'Multi-factor authentication active. Provider free-tier sandbox notice detected.'
              : 'Two-factor authentication required. Check your registered email for the 6-digit security code.'
          )
          return
        }

        if (!data.token || !data.user) {
          throw new Error('Login response was incomplete.')
        }

        sessionStorage.setItem('trustvault_token', data.token)
        sessionStorage.setItem('trustvault_user', JSON.stringify(data.user))
        setLoggedInUser(data.user)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setError('Cannot connect to backend server. If deployed on Render free tier, the backend is waking up (takes ~30-50s). Please wait a moment and click Sign In again.')
      } else {
        setError(msg || 'Unable to connect. Please verify backend is running.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Resend 2FA verification code
  async function handleResendMfa() {
    if (resendCooldown > 0) return
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: mfaTempToken }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('A new verification code has been dispatched to your email.')
        setResendCooldown(30)
      } else {
        setError(data.message || 'Failed to resend verification code.')
      }
    } catch {
      setError('Could not connect to authentication service.')
    } finally {
      setLoading(false)
    }
  }

  // Sign out
  function handleLogout() {
    sessionStorage.removeItem('trustvault_token')
    sessionStorage.removeItem('trustvault_user')
    setLoggedInUser(null)
    setMessage('')
    setError('')
    setPassword('')
    setMode('login')
  }

  // If authenticated and not currently resetting password, display dashboard
  if (loggedInUser && mode !== 'reset') {
    return (
      <Dashboard
        user={loggedInUser}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <main className="auth-page">
      {/* Left Brand Panel */}
      <section className="brand-panel">
        <div className="brand">
          <div className="brand-mark">T</div>
          <span>TrustVault</span>
        </div>

        <div className="brand-content">
          <span className="eyebrow">
            <span className="status-dot" />
            YOUR DOCUMENTS. YOUR CONTROL.
          </span>

          <h1>
            Confidential by
            <br />
            <span>design.</span>
          </h1>

          <p>
            A secure space for your most important documents.
            Manage access, protect sensitive files, and keep
            control over who sees what.
          </p>

          <div className="security-points">
            <div className="security-item">
              <span className="security-icon">◈</span>
              <div>
                <strong>Controlled access</strong>
                <small>Permissions for every document</small>
              </div>
            </div>

            <div className="security-item">
              <span className="security-icon">⌁</span>
              <div>
                <strong>Two-Factor Protection</strong>
                <small>6-digit verification on sign in</small>
              </div>
            </div>

            <div className="security-item">
              <span className="security-icon">▤</span>
              <div>
                <strong>Auditable activity</strong>
                <small>Track supported document actions</small>
              </div>
            </div>
          </div>
        </div>

        <div className="brand-footer">
          <span>TRUSTVAULT SECURITY PLATFORM</span>
          <span>BUILT FOR CONFIDENTIALITY</span>
        </div>
      </section>

      {/* Right Form Panel */}
      <section className="form-panel">
        <div className="mobile-brand">
          <div className="brand-mark">T</div>
          <span>TrustVault</span>
        </div>

        <div className="form-wrap">
          {/* Header Texts */}
          <div className="form-heading">
            <span className="form-kicker">
              {mode === 'login'
                ? 'SECURE SIGN IN'
                : mode === 'register'
                  ? 'GET STARTED'
                  : mode === 'mfa'
                    ? 'SECURITY VERIFICATION'
                    : mode === 'forgot'
                      ? 'PASSWORD RECOVERY'
                      : 'NEW CREDENTIALS'}
            </span>

            <h2>
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'register'
                  ? 'Create your account'
                  : mode === 'mfa'
                    ? 'Two-Factor Authentication'
                    : mode === 'forgot'
                      ? 'Reset your password'
                      : 'Set new password'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Sign in to access your secure document vault.'
                : mode === 'register'
                  ? 'Create an account to get started with TrustVault.'
                  : mode === 'mfa'
                    ? `Enter the 6-digit security code sent to ${mfaEmail}.`
                    : mode === 'forgot'
                      ? 'Enter your registered email to receive a secure reset link.'
                      : `Setting new credentials for ${resetTokenEmail || 'your account'}.`}
            </p>
          </div>

          {/* Mode Switch Tabs (Only for Login & Register) */}
          {(mode === 'login' || mode === 'register') && (
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => {
                  setMode('login')
                  setError('')
                  setMessage('')
                }}
              >
                Sign in
              </button>

              <button
                type="button"
                className={mode === 'register' ? 'active' : ''}
                onClick={() => {
                  setMode('register')
                  setError('')
                  setMessage('')
                }}
              >
                Create account
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* REGISTER: Name input */}
            {mode === 'register' && (
              <label className="field">
                <span>Full name</span>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={100}
                />
              </label>
            )}

            {/* LOGIN / REGISTER / FORGOT: Email input */}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <label className="field">
                <span>Email address</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
            )}

            {/* LOGIN / REGISTER: Password input */}
            {(mode === 'login' || mode === 'register') && (
              <label className="field">
                <div className="field-header-row">
                  <span>Password</span>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="forgot-password-link"
                      onClick={() => {
                        setMode('forgot')
                        setError('')
                        setMessage('')
                        setResetPreviewUrl('')
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  placeholder="Enter your password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                />

                {mode === 'register' && (
                  <small className="field-hint">
                    Use at least 8 characters.
                  </small>
                )}
              </label>
            )}

            {/* MFA: 6-Digit Code Input */}
            {mode === 'mfa' && (
              <div>
                <div className="mfa-security-box">
                  <span>🛡️</span>
                  <p>
                    A 6-digit security code was sent to your registered email {mfaEmail ? `(${maskEmail(mfaEmail)})` : ''}. Please check your inbox or spam folder and enter the code below.
                  </p>
                </div>

                {mfaEvalCode && (
                  <div className="eval-helper-box">
                    <div className="eval-helper-title">
                      🧪 Evaluation Sandbox Notice
                    </div>
                    <p className="eval-helper-text">
                      External email provider restricted unverified recipient. Verification code: <strong>{mfaEvalCode}</strong>
                    </p>
                    <div className="eval-btn-group">
                      <button
                        type="button"
                        className="autofill-login-primary-btn"
                        onClick={() => {
                          setMfaCode(mfaEvalCode)
                          verifyMfaCode(mfaEvalCode)
                        }}
                      >
                        ⚡ Autofill &amp; Sign In Instantly
                      </button>
                      <button
                        type="button"
                        className="autofill-fill-only-btn"
                        onClick={() => {
                          setMfaCode(mfaEvalCode)
                          setTimeout(() => {
                            const btn = document.getElementById('auth-submit-btn') || document.querySelector('.submit-button')
                            if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }, 50)
                        }}
                      >
                        Insert Code ({mfaEvalCode})
                      </button>
                    </div>
                  </div>
                )}

                <label className="field">
                  <span>6-Digit Security Code</span>
                  <input
                    type="text"
                    className="mfa-code-input"
                    placeholder="000000"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </label>
              </div>
            )}

            {/* RESET PASSWORD: New password inputs */}
            {mode === 'reset' && (
              <div>
                <label className="field">
                  <span>New Password</span>
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <small className="field-hint">Use at least 8 characters.</small>
                </label>

                <label className="field">
                  <span>Confirm New Password</span>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </label>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="notice success" role="status">
                {message}
              </div>
            )}

            {/* Submit Button */}
            <button
              id="auth-submit-btn"
              className="submit-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Verifying...'
                : mode === 'login'
                  ? 'Sign in securely'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'mfa'
                      ? 'Verify Code & Access Vault'
                      : mode === 'forgot'
                        ? 'Send Reset Link'
                        : 'Save New Password'}

              {!loading && (
                <span aria-hidden="true">→</span>
              )}
            </button>

            {/* MFA Resend button */}
            {mode === 'mfa' && (
              <button
                type="button"
                className="forgot-password-link"
                style={{ display: 'block', margin: '14px auto 0', textAlign: 'center' }}
                onClick={handleResendMfa}
                disabled={loading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
              </button>
            )}

            {/* Navigation back to login for other modes */}
            {(mode === 'forgot' || mode === 'mfa' || mode === 'reset') && (
              <button
                type="button"
                className="forgot-password-link"
                style={{ display: 'block', margin: '14px auto 0', textAlign: 'center', fontSize: '13px' }}
                onClick={() => {
                  setMode('login')
                  setError('')
                  setMessage('')
                  setMfaCode('')
                  setMfaTempToken('')
                  setResetToken('')
                }}
              >
                ← Back to sign in
              </button>
            )}
          </form>

          {/* Form security reassurance */}
          <div className="form-security">
            <span aria-hidden="true">▣</span>
            Protected by end-to-end encryption &amp; Multi-Factor Authentication.
          </div>
        </div>

        <footer className="form-footer">
          <span>© 2026 TrustVault</span>
          <span>Secure document management</span>
        </footer>
      </section>
    </main>
  )
}

export default App
