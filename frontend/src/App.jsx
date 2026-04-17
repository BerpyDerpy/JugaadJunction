import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Lock, User, AlertCircle, CheckCircle2, Hexagon } from 'lucide-react'

function App() {
  const [rollno, setRollno] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // In a real app we'd use Supabase Auth, but per requirements we're
      // using the UserTable for our credentials.
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
      } else {
        throw new Error('Invalid roll number or password.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

        {user ? (
          <div className="success-message">
            <CheckCircle2 size={48} color="#4ade80" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ marginBottom: '8px' }}>Welcome, {user.username}!</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>You have successfully logged in.</p>
            
            <div className="user-card">
              <div className="user-card-item">
                <span className="form-label">Roll Number</span>
                <span>{user.rollno}</span>
              </div>
              <div className="user-card-item">
                <span className="form-label">Username</span>
                <span>@{user.username}</span>
              </div>
              <div className="user-card-item">
                <span className="form-label">Social Credit</span>
                <span className="credit-score">{user.social_credit}/100</span>
              </div>
            </div>

            <button 
              className="submit-btn" 
              style={{ width: '100%', marginTop: '24px' }}
              onClick={() => {
                setUser(null);
                setRollno('');
                setPassword('');
              }}
            >
              Log Out
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
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
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="submit-btn" 
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default App
