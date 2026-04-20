import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import {
  ArrowLeft,
  Package,
  Megaphone,
  Hand,
  CheckCircle2,
  Award,
  User,
  Pencil,
  Lock,
  Check,
  X,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react'
import { playPop, playSuccess, playError } from './sounds'
import NameTag from './NameTag'
import './Marketplace.css'
import './Dashboard.css'

// ── Card styling helpers (same as Marketplace) ─────────────────
const CARD_VARIANTS = ['variant-cream', 'variant-blue', 'variant-yellow', 'variant-pink', 'variant-green']
const PIN_COLORS = ['pin-red', 'pin-yellow', 'pin-green', 'pin-blue', 'pin-orange']
function pick(arr, i) { return arr[i % arr.length] }

// ── Credit Wheel (reused from Dashboard logic) ─────────────────
function CreditWheel({ score, max = 100 }) {
  const radius = 38
  const stroke = 7
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(score / max, 1)
  const offset = circumference * (1 - pct)

  let color = '#ef4444'
  if (pct > 0.7) color = '#22c55e'
  else if (pct > 0.4) color = '#eab308'

  return (
    <div className="db-credit-wheel" id="profile-credit-wheel">
      <svg viewBox="0 0 100 100" className="db-credit-svg">
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="rgba(245,230,211,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="db-credit-arc"
        />
      </svg>
      <div className="db-credit-value">
        <span className="db-credit-number">{score}</span>
        <span className="db-credit-label">Credit</span>
      </div>
    </div>
  )
}

// ── Badge definitions ──────────────────────────────────────────
const BADGE_DEFS = [
  { id: 'first_helper',    emoji: '🤝', label: 'First Helper',    desc: 'Claimed your first ticket',    check: (s) => s.claimed >= 1 },
  { id: 'power_user',      emoji: '⚡', label: 'Power User',      desc: 'Created 5+ tickets',           check: (s) => s.created >= 5 },
  { id: 'deal_closer',     emoji: '🏆', label: 'Deal Closer',     desc: 'Closed 3+ tickets as owner',   check: (s) => s.closed >= 3 },
  { id: 'ten_x_helper',    emoji: '🔥', label: '10x Helper',      desc: 'Claimed 10+ tickets',          check: (s) => s.claimed >= 10 },
  { id: 'prolific_poster', emoji: '🎯', label: 'Prolific Poster', desc: 'Created 10+ tickets',          check: (s) => s.created >= 10 },
  { id: 'elite_trader',    emoji: '💎', label: 'Elite Trader',     desc: 'Closed 10+ tickets as owner',  check: (s) => s.closed >= 10 },
]

// ── ProfileTicketCard (read-only, reuses marketplace card styling) ──
function ProfileTicketCard({ ticket, index, studentNames }) {
  const showTape = index % 4 === 1
  const showStain = index % 5 === 3

  return (
    <div
      className={`mp-ticket ${pick(CARD_VARIANTS, index)}`}
      style={{ animationDelay: `${index * 0.06}s` }}
      id={`profile-ticket-${ticket.id}`}
    >
      <div className={`mp-pin ${pick(PIN_COLORS, index)}`} />
      {showTape && <div className={`mp-tape ${index % 2 === 0 ? '' : 'tape-left'}`} />}
      {showStain && <div className="mp-stain" />}

      <span className={`mp-ticket-type ${ticket.type === 'request' ? 'request-type' : 'seller-type'}`}>
        {ticket.type === 'request' ? 'Request' : 'Offer'}
      </span>

      <div className="mp-ticket-id">{ticket.id}</div>
      <div className="mp-ticket-title">{ticket.title}</div>

      {ticket.price > 0 && (
        <span className="mp-ticket-price">₹{ticket.price}</span>
      )}

      <div className="mp-ticket-desc">{ticket.desc}</div>
      <span className="mp-ticket-category">{ticket.category}</span>

      <div className="mp-ticket-footer">
        <span className="mp-ticket-user">
          <span className="mp-ticket-user-dot" />
          <NameTag username={ticket.user} realName={studentNames?.[ticket.ownerRollno] || 'Unknown'} />
        </span>
        <span className={`mp-status ${ticket.status}`}>{ticket.status}</span>
      </div>
    </div>
  )
}

// ── Profile Page ───────────────────────────────────────────────
export default function Profile({ user, setUser, onLogout }) {
  const { rollno } = useParams()
  const navigate = useNavigate()

  const [profileUser, setProfileUser] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [socialCredit, setSocialCredit] = useState(0)
  const [studentNames, setStudentNames] = useState({})

  const [ownedTickets, setOwnedTickets] = useState([])
  const [claimedTickets, setClaimedTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState('created')

  // edit profile state
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const [toast, setToast] = useState(null)

  // fetch everything on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setNotFound(false)

      try {
        // 1. fetch user info
        const { data: userData, error: userError } = await supabase
          .from('UserTable')
          .select('username, social_credit, rollno')
          .eq('rollno', rollno)
          .single()

        if (userError || !userData) {
          setNotFound(true)
          setLoading(false)
          return
        }

        setProfileUser(userData)
        setSocialCredit(userData.social_credit)

        // 2. fetch real name
        const { data: nameData } = await supabase
          .from('StudentNames')
          .select('first_name')
          .eq('rollno', rollno)
          .single()

        if (nameData) setFirstName(nameData.first_name || '')

        // 3. fetch all student names for nametags
        const { data: allNames } = await supabase.from('StudentNames').select('*')
        if (allNames) {
          const map = {}
          allNames.forEach(d => map[d.rollno] = d.first_name || d.real_name || 'Unknown')
          setStudentNames(map)
        }

        // 4. fetch owned tickets
        const { data: ownedData } = await supabase
          .from('TicketTable')
          .select(`
            ticketid, type, owner_rollno, claimant_rollno,
            owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
            title, description, category, status, "ItemPrice"
          `)
          .eq('owner_rollno', rollno)

        if (ownedData) {
          setOwnedTickets(ownedData.map(formatTicket).reverse())
        }

        // 5. fetch claimed tickets
        const { data: claimsData } = await supabase
          .from('TicketClaims')
          .select(`
            ticket:TicketTable!inner (
              ticketid, type, owner_rollno, claimant_rollno,
              owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
              title, description, category, status, "ItemPrice"
            )
          `)
          .eq('claimant_rollno', rollno)

        if (claimsData) {
          const unwrapped = claimsData
            .map(c => Array.isArray(c.ticket) ? c.ticket[0] : c.ticket)
            .filter(Boolean)
          setClaimedTickets(unwrapped.map(formatTicket).reverse())
        }
      } catch (err) {
        console.error('Error loading profile:', err)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [rollno])

  const formatTicket = (t) => {
    const ownerObj = Array.isArray(t.owner) ? t.owner[0] : t.owner
    const username = ownerObj ? ownerObj.username : 'unknown'
    return {
      id: String(t.type === 'request' ? 'REQ-' : 'SEL-') + t.ticketid,
      ticketid: t.ticketid,
      title: t.title || 'Untitled',
      desc: t.description || '',
      category: t.category || 'General',
      price: t.ItemPrice || 0,
      user: username,
      ownerRollno: t.owner_rollno,
      claimantRollno: t.claimant_rollno,
      status: t.status || 'pending',
      type: t.type || 'request',
    }
  }

  // ── Derived stats ────────────────────────────────────────────
  const stats = useMemo(() => ({
    created: ownedTickets.length,
    claimed: claimedTickets.length,
    closed: ownedTickets.filter(t => t.status === 'closed').length,
  }), [ownedTickets, claimedTickets])

  const earnedBadges = useMemo(
    () => BADGE_DEFS.map(b => ({ ...b, earned: b.check(stats) })),
    [stats]
  )

  const isOwnProfile = user?.rollno === rollno

  const initials = profileUser?.username
    ? profileUser.username.slice(0, 2).toUpperCase()
    : '??'

  const activeList = activeTab === 'created' ? ownedTickets : claimedTickets

  // ── Username change handler ──────────────────────────────────
  const handleUsernameChange = async () => {
    const trimmed = newUsername.trim()
    setUsernameError('')

    if (!trimmed) {
      setUsernameError('Username cannot be empty.')
      return
    }
    if (trimmed.length < 3) {
      setUsernameError('Username must be at least 3 characters.')
      return
    }
    if (trimmed.length > 30) {
      setUsernameError('Username must be 30 characters or less.')
      return
    }
    if (trimmed === profileUser.username) {
      setEditingUsername(false)
      return
    }

    setUsernameSaving(true)
    try {
      const { error } = await supabase
        .from('UserTable')
        .update({ username: trimmed })
        .eq('rollno', rollno)

      if (error) throw error

      // update local state
      setProfileUser(prev => ({ ...prev, username: trimmed }))

      // update session
      if (setUser) {
        const updatedUser = { ...user, username: trimmed }
        setUser(updatedUser)
        localStorage.setItem('jj_user', JSON.stringify(updatedUser))
      }

      playSuccess()
      setEditingUsername(false)
      setToast('✏️ Username updated successfully!')
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      console.error('Error updating username:', err)
      playError()
      setUsernameError(err.message || 'Failed to update username.')
    } finally {
      setUsernameSaving(false)
    }
  }

  // ── Password change handler ──────────────────────────────────
  const handlePasswordChange = async () => {
    setPasswordError('')

    if (!currentPassword) {
      setPasswordError('Please enter your current password.')
      return
    }
    if (!newPassword) {
      setPasswordError('Please enter a new password.')
      return
    }
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current.')
      return
    }

    setPasswordSaving(true)
    try {
      // verify current password
      const { data: userData, error: fetchError } = await supabase
        .from('UserTable')
        .select('password')
        .eq('rollno', rollno)
        .single()

      if (fetchError) throw fetchError

      if (userData.password !== currentPassword) {
        setPasswordError('Current password is incorrect.')
        playError()
        setPasswordSaving(false)
        return
      }

      // update password
      const { error: updateError } = await supabase
        .from('UserTable')
        .update({ password: newPassword })
        .eq('rollno', rollno)

      if (updateError) throw updateError

      // update session
      if (setUser) {
        const updatedUser = { ...user, password: newPassword }
        setUser(updatedUser)
        localStorage.setItem('jj_user', JSON.stringify(updatedUser))
      }

      playSuccess()
      setChangingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrentPw(false)
      setShowNewPw(false)
      setShowConfirmPw(false)
      setToast('🔒 Password changed successfully!')
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      console.error('Error updating password:', err)
      playError()
      setPasswordError(err.message || 'Failed to update password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const cancelUsernameEdit = () => {
    setEditingUsername(false)
    setNewUsername('')
    setUsernameError('')
  }

  const cancelPasswordChange = () => {
    setChangingPassword(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setShowCurrentPw(false)
    setShowNewPw(false)
    setShowConfirmPw(false)
  }

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="marketplace" id="profile-root">
        <header className="mp-topbar" id="profile-topbar">
          <span className="mp-topbar-title">📌 Jugaad Junction</span>
          <div className="mp-topbar-user">
            <button
              className="mp-logout-btn"
              onClick={() => navigate('/')}
              id="profile-back-btn"
            >
              <ArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Back
            </button>
          </div>
        </header>
        <main className="mp-board">
          <div className="db-loading">
            <div className="db-spinner" />
            <span>Loading profile…</span>
          </div>
        </main>
      </div>
    )
  }

  // ── Not found state ──────────────────────────────────────────
  if (notFound) {
    return (
      <div className="marketplace" id="profile-root">
        <header className="mp-topbar" id="profile-topbar">
          <span className="mp-topbar-title">📌 Jugaad Junction</span>
          <div className="mp-topbar-user">
            <button
              className="mp-logout-btn"
              onClick={() => navigate('/')}
              id="profile-back-btn"
            >
              <ArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Back
            </button>
          </div>
        </header>
        <main className="mp-board">
          <div className="mp-empty">
            <div className="mp-empty-icon">👻</div>
            User not found. Either they don't exist or they're hiding.
          </div>
        </main>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="marketplace" id="profile-root">
      {/* ── Top bar ── */}
      <header className="mp-topbar" id="profile-topbar">
        <span className="mp-topbar-title">📌 Jugaad Junction</span>
        <div className="mp-topbar-user">
          <button
            className="mp-logout-btn"
            onClick={() => navigate('/')}
            id="profile-back-btn"
          >
            <ArrowLeft size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Back to Marketplace
          </button>
        </div>
      </header>

      <main className="mp-board" style={{ maxWidth: 720, paddingTop: 24 }}>
        {/* ── Profile Header ── */}
        <div className="db-user-header" id="profile-header" style={{ background: 'rgba(245, 230, 211, 0.06)', border: '1.5px solid rgba(245, 230, 211, 0.12)', borderRadius: 16, padding: '24px 28px', marginBottom: 24 }}>
          <div className="db-avatar" style={{ width: 64, height: 64, fontSize: 24 }}>{initials}</div>
          <div className="db-user-info" style={{ flex: 1 }}>
            {editingUsername ? (
              <div className="pf-username-edit" id="profile-username-edit">
                <div className="pf-username-edit-row">
                  <span className="pf-username-at">@</span>
                  <input
                    id="profile-username-input"
                    className="pf-username-input"
                    type="text"
                    value={newUsername}
                    onChange={(e) => { setNewUsername(e.target.value); setUsernameError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUsernameChange()}
                    placeholder="Enter new username"
                    autoFocus
                    maxLength={30}
                  />
                  <button
                    className="pf-edit-action-btn pf-save-btn"
                    onClick={handleUsernameChange}
                    disabled={usernameSaving}
                    id="profile-username-save"
                    title="Save"
                  >
                    {usernameSaving ? <div className="mp-detail-btn-spinner" /> : <Check size={16} />}
                  </button>
                  <button
                    className="pf-edit-action-btn pf-cancel-btn"
                    onClick={cancelUsernameEdit}
                    id="profile-username-cancel"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
                {usernameError && <div className="pf-edit-error">{usernameError}</div>}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 className="db-username" style={{ fontSize: 28 }}>@{profileUser.username}</h2>
                {isOwnProfile && (
                  <button
                    className="pf-inline-edit-btn"
                    onClick={() => { setNewUsername(profileUser.username); setEditingUsername(true); playPop() }}
                    id="profile-edit-username-btn"
                    title="Edit username"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
            <span className="db-rollno">{rollno}</span>
            {firstName && (
              <div style={{ marginTop: 4, fontSize: 14, color: '#d4b896', fontFamily: "'Patrick Hand', cursive" }}>
                {firstName}
                {isOwnProfile && <span style={{ marginLeft: 8, fontSize: 11, color: '#a38568', fontStyle: 'italic' }}>(that's you!)</span>}
              </div>
            )}
          </div>
          <CreditWheel score={socialCredit} />
        </div>

        {/* ── Edit Profile Section (own profile only) ── */}
        {isOwnProfile && (
          <div className="pf-settings-section" id="profile-settings">
            <div className="mp-section-header" style={{ marginBottom: 16 }}>
              <div className="mp-section-icon" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 3px 12px rgba(217, 119, 6, 0.35)' }}>
                <Settings size={20} />
              </div>
              <h2 className="mp-section-title">Account Settings</h2>
            </div>

            {/* ── Change Password ── */}
            {!changingPassword ? (
              <button
                className="pf-settings-btn"
                onClick={() => { setChangingPassword(true); playPop() }}
                id="profile-change-password-btn"
              >
                <Lock size={16} />
                Change Password
              </button>
            ) : (
              <div className="pf-password-form" id="profile-password-form">
                <div className="pf-password-header">
                  <Lock size={18} className="pf-password-header-icon" />
                  <h3>Change Password</h3>
                </div>

                <div className="pf-field">
                  <label htmlFor="current-password">Current Password</label>
                  <div className="pf-password-input-wrapper">
                    <input
                      id="current-password"
                      type={showCurrentPw ? 'text' : 'password'}
                      className="pf-input"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError('') }}
                    />
                    <button
                      className="pf-pw-toggle"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      type="button"
                      tabIndex={-1}
                    >
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pf-field">
                  <label htmlFor="new-password">New Password</label>
                  <div className="pf-password-input-wrapper">
                    <input
                      id="new-password"
                      type={showNewPw ? 'text' : 'password'}
                      className="pf-input"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
                    />
                    <button
                      className="pf-pw-toggle"
                      onClick={() => setShowNewPw(!showNewPw)}
                      type="button"
                      tabIndex={-1}
                    >
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pf-field">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <div className="pf-password-input-wrapper">
                    <input
                      id="confirm-password"
                      type={showConfirmPw ? 'text' : 'password'}
                      className="pf-input"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
                      onKeyDown={(e) => e.key === 'Enter' && handlePasswordChange()}
                    />
                    <button
                      className="pf-pw-toggle"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      type="button"
                      tabIndex={-1}
                    >
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {passwordError && <div className="pf-edit-error">{passwordError}</div>}

                <div className="pf-password-actions">
                  <button
                    className="pf-pw-save-btn"
                    onClick={handlePasswordChange}
                    disabled={passwordSaving}
                    id="profile-password-save"
                  >
                    {passwordSaving ? (
                      <><div className="mp-detail-btn-spinner" /> Saving...</>
                    ) : (
                      <><Check size={16} /> Update Password</>
                    )}
                  </button>
                  <button
                    className="pf-pw-cancel-btn"
                    onClick={cancelPasswordChange}
                    id="profile-password-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Stats Row ── */}
        <div id="profile-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { icon: <Package size={20} />, label: 'Created', value: stats.created, gradient: 'linear-gradient(135deg, #22c55e, #16a34a)', shadow: 'rgba(34, 197, 94, 0.3)' },
            { icon: <Hand size={20} />, label: 'Claimed', value: stats.claimed, gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', shadow: 'rgba(59, 130, 246, 0.3)' },
            { icon: <CheckCircle2 size={20} />, label: 'Closed', value: stats.closed, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', shadow: 'rgba(245, 158, 11, 0.3)' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: 'rgba(245, 230, 211, 0.06)',
                border: '1.5px solid rgba(245, 230, 211, 0.12)',
                borderRadius: 14,
                padding: '20px 16px',
                textAlign: 'center',
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10, margin: '0 auto 10px',
                background: s.gradient, boxShadow: `0 3px 12px ${s.shadow}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
              }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f5e6d3', lineHeight: 1, fontFamily: "'Caveat', cursive" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#a38568', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Badges ── */}
        <div id="profile-badges" style={{ marginBottom: 28 }}>
          <div className="mp-section-header" style={{ marginBottom: 16 }}>
            <div className="mp-section-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', boxShadow: '0 3px 12px rgba(139, 92, 246, 0.35)' }}>
              <Award size={20} />
            </div>
            <h2 className="mp-section-title">
              Badges
              <span className="mp-section-count">({earnedBadges.filter(b => b.earned).length}/{BADGE_DEFS.length})</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {earnedBadges.map((badge) => (
              <div
                key={badge.id}
                id={`badge-${badge.id}`}
                style={{
                  background: badge.earned ? 'rgba(245, 230, 211, 0.08)' : 'rgba(245, 230, 211, 0.03)',
                  border: `1.5px solid ${badge.earned ? 'rgba(217, 119, 6, 0.3)' : 'rgba(245, 230, 211, 0.08)'}`,
                  borderRadius: 12,
                  padding: '16px 12px',
                  textAlign: 'center',
                  opacity: badge.earned ? 1 : 0.4,
                  transition: 'all 0.25s ease',
                  filter: badge.earned ? 'none' : 'grayscale(1)',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{badge.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f5e6d3', fontFamily: "'Patrick Hand', cursive", lineHeight: 1.2 }}>{badge.label}</div>
                <div style={{ fontSize: 11, color: '#a38568', marginTop: 4, lineHeight: 1.3 }}>{badge.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Ticket History ── */}
        <div id="profile-ticket-history">
          <div className="mp-section-header" style={{ marginBottom: 0 }}>
            <div className="mp-section-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 3px 12px rgba(245, 158, 11, 0.35)' }}>
              <Megaphone size={20} />
            </div>
            <h2 className="mp-section-title">Ticket History</h2>
          </div>

          {/* tabs */}
          <div className="db-tabs" id="profile-tabs" style={{ marginTop: 16, marginBottom: 20 }}>
            <button
              className={`db-tab ${activeTab === 'created' ? 'active' : ''}`}
              onClick={() => setActiveTab('created')}
              id="profile-tab-created"
            >
              <Package size={16} />
              Created ({ownedTickets.length})
            </button>
            <button
              className={`db-tab ${activeTab === 'claimed' ? 'active' : ''}`}
              onClick={() => setActiveTab('claimed')}
              id="profile-tab-claimed"
            >
              <Hand size={16} />
              Claimed ({claimedTickets.length})
            </button>
          </div>

          {/* ticket grid */}
          {activeList.length > 0 ? (
            <div className="mp-ticket-grid" style={{ paddingBottom: 60 }}>
              {activeList.map((t, i) => (
                <ProfileTicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  studentNames={studentNames}
                />
              ))}
            </div>
          ) : (
            <div className="mp-empty">
              <div className="mp-empty-icon">{activeTab === 'created' ? '📦' : '🤝'}</div>
              {activeTab === 'created'
                ? "No tickets created yet."
                : "No tickets claimed yet."}
            </div>
          )}
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className="db-toast" id="profile-toast">
          <span className="db-toast-msg">{toast}</span>
        </div>
      )}
    </div>
  )
}
