import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { Lock, User, AlertCircle, Sparkles, PartyPopper } from 'lucide-react'
import confetti from 'canvas-confetti'
import { generateAbsurdDisgustingNickname } from './nicknameGenerator'
import Marketplace from './Marketplace'
import AdminPanel from './AdminPanel'
import {
  initAudio, playSuccess, playError, playClick, playPop,
  playRevealIntro, playRevealCeremony, playRevealSlam,
  playRevealQuip, playRevealWarning, playRevealReady,
} from './sounds'

// ─── Quip pool for the welcome reveal ───────────────────────────
const QUIPS = [
  "Your parents chose carefully. We did not.",
  "This name will haunt your leaderboard forever.",
  "Complaints can be filed at /dev/null.",
  "Your reputation starts now. No pressure.",
  "We ran it through a very sophisticated algorithm. (We didn't.)",
  "This is permanent. Like a tattoo, but worse.",
  "Legend says the last person who complained got a worse one.",
  "Your dignity called. It said goodbye.",
  "On the bright side, at least it's memorable.",
  "Think of it as a personality test you didn't study for.",
  "We considered your feelings. Then we ignored them.",
]

// ─── Welcome Reveal Screen ─────────────────────────────────────
function WelcomeReveal({ realName, nickname, onContinue }) {
  const containerRef = useRef(null)
  const contentRef = useRef(null)
  // 0=intro, 1=realname, 2=ceremony, 3=nickname+slam, 4=quip, 5=notice, 6=button
  const [phase, setPhase] = useState(0)
  const [showFlash, setShowFlash] = useState(false)
  const [shaking, setShaking] = useState(false)

  // pick a deterministic quip based on the nickname
  const quipIndex = nickname
    ? Math.abs([...nickname].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)) % QUIPS.length
    : 0
  const quip = QUIPS[quipIndex]

  useEffect(() => {
    const timers = []

    // Phase 0: intro shimmer
    timers.push(setTimeout(() => playRevealIntro(), 200))

    // Phase 1: real name appears (0.8s)
    timers.push(setTimeout(() => setPhase(1), 800))

    // Phase 2: ceremony text (2.2s)
    timers.push(setTimeout(() => {
      setPhase(2)
      playRevealCeremony()
    }, 2200))

    // Phase 3: THE NAME SLAMS IN (3.5s)
    timers.push(setTimeout(() => {
      setPhase(3)
      setShowFlash(true)
      setShaking(true)
      playRevealSlam()

      // screen flash fades
      setTimeout(() => setShowFlash(false), 400)
      setTimeout(() => setShaking(false), 500)

      // confetti explosion
      const duration = 3000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#d97706', '#f59e0b', '#b45309', '#f5e6d3', '#ef4444', '#22c55e'],
          gravity: 0.8,
        })
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#d97706', '#f59e0b', '#b45309', '#f5e6d3', '#ef4444', '#22c55e'],
          gravity: 0.8,
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()

      // big center burst
      confetti({
        particleCount: 180,
        spread: 120,
        origin: { x: 0.5, y: 0.5 },
        colors: ['#d97706', '#f59e0b', '#b45309', '#faf3e8', '#ef4444'],
        startVelocity: 50,
        gravity: 1.2,
        ticks: 200,
        scalar: 1.3,
      })
    }, 3500))

    // Phase 4: quip appears (5.2s)
    timers.push(setTimeout(() => {
      setPhase(4)
      playRevealQuip()
    }, 5200))

    // Phase 5: the ominous notice (6.5s)
    timers.push(setTimeout(() => {
      setPhase(5)
      playRevealWarning()
    }, 6500))

    // Phase 6: button (7.5s)
    timers.push(setTimeout(() => {
      setPhase(6)
      playRevealReady()
    }, 7500))

    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="welcome-reveal" ref={containerRef} id="welcome-reveal">
      {/* flash overlay on name slam */}
      {showFlash && <div className="welcome-flash" />}

      {/* drifting warm blobs */}
      <div className="welcome-blobs">
        <div className="welcome-blob blob-1" />
        <div className="welcome-blob blob-2" />
        <div className="welcome-blob blob-3" />
      </div>

      <div className={`welcome-content ${shaking ? 'shaking' : ''}`} ref={contentRef}>
        {/* Phase 0: Intro text */}
        <div className={`welcome-line welcome-greeting ${phase >= 0 ? 'visible' : ''}`}>
          <span className="welcome-emoji">👀</span>
          <span>Ah, a new face appears...</span>
        </div>

        {/* Phase 1: Real name reveal */}
        <div className={`welcome-line welcome-real-name ${phase >= 1 ? 'visible' : ''}`}>
          {realName}
        </div>

        {/* Phase 2: Ceremony text */}
        <div className={`welcome-divider ${phase >= 2 ? 'visible' : ''}`} />

        <div className={`welcome-ceremony-label ${phase >= 2 ? 'visible' : ''}`}>
          The Sorting Ceremony has spoken...
        </div>

        <div className={`welcome-line welcome-identity-label ${phase >= 2 ? 'visible' : ''}`}>
          <Sparkles size={16} className="welcome-sparkle" />
          Your new identity is
        </div>

        {/* Phase 3: THE NICKNAME slams in */}
        <div className={`welcome-line welcome-nickname ${phase >= 3 ? 'visible' : ''}`}>
          {nickname}
        </div>

        {/* Phase 4: Humorous quip */}
        <div className={`welcome-quip ${phase >= 4 ? 'visible' : ''}`}>
          <span className="welcome-quip-icon"></span>
          {quip}
        </div>

        {/* Phase 5: The ominous notice */}
        <div className={`welcome-notice ${phase >= 5 ? 'visible' : ''}`}>
          <span className="welcome-notice-icon"></span>
          <span>You cannot change this btw :) </span>
        </div>

        {/* Phase 6: Continue button */}
        <button
          className={`welcome-continue-btn ${phase >= 6 ? 'visible' : ''}`}
          onClick={() => { playPop(); onContinue() }}
          id="welcome-continue-btn"
        >
          <PartyPopper size={20} />
          Enter the Marketplace
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

  const [adminMode, setAdminMode] = useState('admin')

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

        // 2. Generate the nickname
        const nickname = generateAbsurdDisgustingNickname(realName)

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
          throw new Error('Database error.')
        }

        // Note: Storing plain passwords ain't secure, but keeping it simple as per schema!
        if (data && data.password === password) {
          playSuccess()
          setUser(data)
          localStorage.setItem('jj_user', JSON.stringify(data))
        } else {
          throw new Error('Invalid roll number or password.')
        }
      }
    } catch (err) {
      playError()
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

  // If user is logged in, route admin vs regular user
  if (user) {
    if (user.rollno === '9999' && adminMode === 'admin') {
      return (
        <AdminPanel
          user={user}
          onLogout={() => {
            setUser(null)
            setRollno('')
            setPassword('')
            localStorage.removeItem('jj_user')
            setAdminMode('admin')
          }}
          onToggleView={() => setAdminMode('marketplace')}
        />
      )
    }
    return (
      <Marketplace
        user={user}
        onLogout={() => {
          setUser(null)
          setRollno('')
          setPassword('')
          localStorage.removeItem('jj_user')
          setAdminMode('admin')
        }}
        onToggleAdminView={user.rollno === '9999' ? () => setAdminMode('admin') : undefined}
      />
    )
  }

  return (
    <div className="login-container">
      {/* warm floating blobs */}
      <div className="background-spheres">
        <div className="sphere sphere-1"></div>
        <div className="sphere sphere-2"></div>
        <div className="sphere sphere-3"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            📌
          </div>
          <h1 className="login-title">Jugaad Junction</h1>
          <p className="login-subtitle">The unofficial exchange of all things essential</p>
        </div>

        <form className="login-form" onSubmit={(e) => { initAudio(); handleAuth(e) }}>
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
                placeholder="ex: 160124737***"
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
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>

          <div className="auth-toggle">
            <span onClick={() => { setIsSignUp(!isSignUp); setError(null) }}>
              {isSignUp
                ? "Already have a name? Sign in"
                : "Fresh meat? Sign up"}
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
