import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { Lock, User, AlertCircle, Hexagon, Sparkles, PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti'
import { generateDisgustingNickname } from './nicknameGenerator'
import Marketplace from './Marketplace'

// ─── Welcome Reveal Screen ─────────────────────────────────────
function WelcomeReveal({ realName, nickname, onContinue }) {
  const containerRef = useRef(null)
  const [phase, setPhase] = useState(0) // 0=name, 1=nickname, 2=notice, 3=button

  useEffect(() => {
    // Stagger the reveals
    const t1 = setTimeout(() => setPhase(1), 800)
    const t2 = setTimeout(() => {
      setPhase(2)
      // CONFETTI EXPLOSION 🎉
      const duration = 3000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6'],
          gravity: 0.8,
        })
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6'],
          gravity: 0.8,
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      // Big center burst
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#a855f7', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6'],
        startVelocity: 45,
        gravity: 1.2,
        ticks: 200,
        scalar: 1.2,
      })
    }, 2000)
    const t3 = setTimeout(() => setPhase(3), 3200)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div className="welcome-reveal" ref={containerRef} id="welcome-reveal">
      {/* Drifting blobby background */}
      <div className="welcome-blobs">
        <div className="welcome-blob blob-1" />
        <div className="welcome-blob blob-2" />
        <div className="welcome-blob blob-3" />
      </div>

      <div className="welcome-content">
        {/* Phase 0: Real name */}
        <div className={`welcome-line welcome-greeting ${phase >= 0 ? 'visible' : ''}`}>
          <span className="welcome-emoji">👋</span>
          <span>Welcome, {realName}</span>
        </div>

        <div className={`welcome-line welcome-real-name ${phase >= 0 ? 'visible' : ''}`}>
          {realName}
        </div>

        {/* Phase 1: Nickname reveal */}
        <div className={`welcome-divider ${phase >= 1 ? 'visible' : ''}`} />

        <div className={`welcome-line welcome-identity-label ${phase >= 1 ? 'visible' : ''}`}>
          <Sparkles size={18} className="welcome-sparkle" />
          Your new identity is
        </div>

        <div className={`welcome-line welcome-nickname ${phase >= 1 ? 'visible' : ''}`}>
          {nickname}
        </div>

        {/* Phase 2: The notice */}
        <div className={`welcome-notice ${phase >= 2 ? 'visible' : ''}`}>
          <span className="welcome-notice-icon">⚠️</span>
          <span>You cannot change this btw</span>
        </div>

        {/* Phase 3: Continue button */}
        <button
          className={`welcome-continue-btn ${phase >= 3 ? 'visible' : ''}`}
          onClick={onContinue}
          id="welcome-continue-btn"
        >
          <PartyPopper size={20} />
          Enter the Bazaar
        </button>
      </div>
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────────
function App() {
  const [rollno, setRollno] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSignUp, setIsSignUp] = useState(false)

  // Welcome reveal state
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeData, setWelcomeData] = useState(null) // { realName, nickname, userData }

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
        // ── SIGN UP FLOW ───────────────────────────────────────
        const trimmedRollno = rollno.trim()

        // 1. Fetch real name from StudentNames table
        const { data: studentData, error: studentError } = await supabase
          .from('StudentNames')
          .select('first_name')
          .eq('rollno', trimmedRollno)
          .single()

        // Debug: log the raw supabase response
        console.log('[Signup] rollno sent:', JSON.stringify(trimmedRollno))
        console.log('[Signup] studentData:', studentData)
        console.log('[Signup] studentError:', studentError)

        if (studentError || !studentData) {
          throw new Error(
            'Roll number not found in student registry. Are you sure you belong here? 🤨'
          )
        }

        const realName = studentData.first_name

        // 2. Generate the disgusting nickname
        const nickname = generateDisgustingNickname(realName)

        // 3. Create the user in UserTable
        const newUser = {
          rollno: trimmedRollno,
          password,
          username: nickname,
          social_credit: 100,
        }

        const { data, error: insertError } = await supabase
          .from('UserTable')
          .insert([newUser])
          .select()
          .single()

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error(
              'This roll number already has an account. What are you trying to pull? Sign in instead.'
            )
          }
          throw new Error(insertError.message || 'Failed to create account.')
        }

        const userData = data || newUser

        // 4. Show the welcome reveal instead of going directly to marketplace
        setWelcomeData({ realName, nickname, userData })
        setShowWelcome(true)
      } else {
        // ── LOGIN FLOW ─────────────────────────────────────────
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

  // Handle "continue" from welcome reveal
  const handleWelcomeContinue = () => {
    if (welcomeData) {
      setUser(welcomeData.userData)
      localStorage.setItem('jj_user', JSON.stringify(welcomeData.userData))
      setShowWelcome(false)
      setWelcomeData(null)
    }
  }

  // If showing welcome reveal
  if (showWelcome && welcomeData) {
    return (
      <WelcomeReveal
        realName={welcomeData.realName}
        nickname={welcomeData.nickname}
        onContinue={handleWelcomeContinue}
      />
    )
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
            {loading ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                {isSignUp ? 'Generating your fate...' : 'Authenticating...'}
              </span>
            ) : (
              isSignUp ? '🎲 Roll the Dice (Sign Up)' : 'Sign In'
            )}
          </button>

          <div className="auth-toggle">
            <span onClick={() => { setIsSignUp(!isSignUp); setError(null) }}>
              {isSignUp
                ? "Already cursed with a name? Sign in"
                : "Fresh meat? Sign up for a name you can't escape"}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
