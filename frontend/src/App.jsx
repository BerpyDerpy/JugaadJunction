import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Lock, User, AlertCircle, CheckCircle2, Hexagon } from 'lucide-react'
import Marketplace from './Marketplace'

function App() {
  const [rollno, setRollno] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)

  // ── Restore session from localStorage ──────────────────────────
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('jj_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isSignUp) {
        // Sign up flow
        const username = 'Student_' + rollno; // Auto-generate username as it is NOT NULL in DB
        const newUser = {
          rollno,
          password,
          username,
          social_credit: 100
        }

        const { data, error: insertError } = await supabase
          .from('UserTable')
          .insert([newUser])
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('User already exists with this roll number. Please sign in.')
          }
          throw new Error(insertError.message || 'Failed to create account.')
        }

        setUser(data || newUser)
        localStorage.setItem('jj_user', JSON.stringify(data || newUser))
      } else {
        // Login flow
        const { data, error: dbError } = await supabase
          .from('UserTable')
          .select('*')
          .eq('rollno', rollno)
          .single()

        if (dbError) {
          if (dbError.code === 'PGRST116') {
            throw new Error('Invalid roll number or password.')
          }
          throw new Error('Database error. Did you run the SQL seed in Supabase?')
        }

        // Note: Storing plain passwords ain't secure, but keeping it simple as per schema!
        if (data && data.password === password) {
          setUser(data)
          localStorage.setItem('jj_user', JSON.stringify(data))
        } else {
          throw new Error('Invalid roll number or password.')
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // If user is logged in, show the marketplace full-screen
  if (user) {
    return (
      <Marketplace
        user={user}
        onLogout={() => {
          setUser(null)
          setRollno('')
          setPassword('')
          localStorage.removeItem('jj_user')
        }}
      />
    )
  }

  return (
    <div className="login-container">
      {/* Background animated geometric elements */}
      <div className="background-spheres">
        <div className="sphere sphere-1"></div>
        <div className="sphere sphere-2"></div>
        <div className="sphere sphere-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <Hexagon className="login-logo" strokeWidth={2.5} />
          </div>
          <h1 className="login-title">Jugaad Junction</h1>
          <p className="login-subtitle">Student Resource Portal</p>
        </div>

        <form className="login-form" onSubmit={handleAuth}>
          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="rollno">Roll Number</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                id="rollno"
                type="text"
                className="form-input"
                placeholder="e.g. 160124737177"
                value={rollno}
                onChange={(e) => setRollno(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('password')?.focus();
                  }
                }}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAuth(e)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>

          <div className="auth-toggle">
            <span onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
