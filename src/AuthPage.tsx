
import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Stethoscope,
  UserRound,
  ShieldCheck,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './AuthPage.css'

interface AuthPageProps {
  onBack: () => void
  onSuccess: () => void
}

type AuthMode = 'login' | 'signup' | 'forgot'
type AccountType = 'patient' | 'doctor'

export default function AuthPage({ onBack, onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [accountType, setAccountType] = useState<AccountType>('patient')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const resetMessages = () => {
    setError('')
    setMessage('')
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    resetMessages()

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name.')
        return
      }

      if (password.length < 6) {
        setError('Password must contain at least 6 characters.')
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    if (mode === 'login' && !password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'signup') {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              account_type: accountType,
            },
          },
        })

        if (signupError) throw signupError

        if (data.session) {
          onSuccess()
        } else {
          setMessage(
            `Your ${accountType} account has been created. Please verify your email, then log in.`
          )
          setMode('login')
          setPassword('')
          setConfirmPassword('')
        }
      } else if (mode === 'login') {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (loginError) throw loginError

        onSuccess()
      } else {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(email.trim())

        if (resetError) throw resetError

        setMessage('Password reset instructions have been sent to your email.')
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-background-glow" />

      <button className="auth-back-button" onClick={onBack} type="button">
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="auth-layout">
        <div className="auth-intro">
          <div className="auth-brand">
            <div className="auth-brand-icon">Y</div>
            <span>Bavyesh's YDHYA</span>
          </div>

          <h1>
            Your health.
            <br />
            Your priority.
          </h1>

          <p>
            Access healthcare services, connect with doctors and manage your
            health journey in one place.
          </p>

          <div className="auth-security-note">
            <ShieldCheck size={19} />
            <span>Your health information deserves privacy and protection.</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => {
                setMode('login')
                resetMessages()
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => {
                setMode('signup')
                resetMessages()
              }}
            >
              Sign Up
            </button>
          </div>

          <div className="auth-card-heading">
            <h2>
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'signup'
                  ? 'Create your account'
                  : 'Reset password'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Log in to continue to YDHYA.'
                : mode === 'signup'
                  ? 'Choose your account type and get started.'
                  : 'Enter your email to receive reset instructions.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div className="auth-account-selector">
                  <p className="auth-selector-label">I am registering as</p>

                  <div className="auth-account-options">
                    <button
                      type="button"
                      className={`auth-account-option ${
                        accountType === 'patient' ? 'selected' : ''
                      }`}
                      onClick={() => setAccountType('patient')}
                    >
                      <UserRound size={21} />
                      <span>Patient</span>
                      <small>Access healthcare</small>
                    </button>

                    <button
                      type="button"
                      className={`auth-account-option ${
                        accountType === 'doctor' ? 'selected' : ''
                      }`}
                      onClick={() => setAccountType('doctor')}
                    >
                      <Stethoscope size={21} />
                      <span>Doctor</span>
                      <small>Join as a doctor</small>
                    </button>
                  </div>
                </div>

                <label className="auth-field">
                  Full name
                  <div className="auth-input-wrap">
                    <User size={18} />
                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>
              </>
            )}

            <label className="auth-field">
              Email address
              <div className="auth-input-wrap">
                <Mail size={18} />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            {mode !== 'forgot' && (
              <label className="auth-field">
                Password
                <div className="auth-input-wrap">
                  <Lock size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'signup' && (
              <label className="auth-field">
                Confirm password
                <div className="auth-input-wrap">
                  <Lock size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </label>
            )}

            {mode === 'login' && (
              <button
                type="button"
                className="forgot-password"
                onClick={() => {
                  setMode('forgot')
                  resetMessages()
                }}
              >
                Forgot password?
              </button>
            )}

            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-message">{message}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Login'
                  : mode === 'signup'
                    ? `Create ${accountType} account`
                    : 'Send reset instructions'}
            </button>
          </form>

          {mode === 'forgot' && (
            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setMode('login')
                resetMessages()
              }}
            >
              Back to Login
            </button>
          )}

          {mode !== 'forgot' && (
            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  resetMessages()
                }}
              >
                {mode === 'login' ? 'Create account' : 'Login'}
              </button>
            </p>
          )}

          <div className="auth-security-note">
            <ShieldCheck size={16} />
            <span>Secure authentication powered by Supabase</span>
          </div>
        </div>
      </div>
    </div>
  )
}
