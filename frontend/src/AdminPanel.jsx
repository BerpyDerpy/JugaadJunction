import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import {
  LogOut,
  Shield,
  Search,
  Save,
  Users,
  MessageSquareWarning,
  CheckCircle2,
  RotateCcw,
  X,
  AlertCircle,
} from 'lucide-react'
import './AdminPanel.css'

// ─── AdminPanel ─────────────────────────────────────────────────
export default function AdminPanel({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('credits') // 'credits' | 'complaints'
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  // credit scores state
  const [users, setUsers] = useState([])
  const [studentNames, setStudentNames] = useState({})
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [editedCredits, setEditedCredits] = useState({}) // { rollno: value }
  const [savedRows, setSavedRows] = useState({}) // { rollno: true } for animation

  // complaints state
  const [complaints, setComplaints] = useState([])
  const [loadingComplaints, setLoadingComplaints] = useState(true)
  const [selectedComplaint, setSelectedComplaint] = useState(null)

  // ── Fetch all users ──────────────────────────────────────────
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('UserTable')
        .select('*')
        .order('rollno')

      if (error) throw error
      if (data) setUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoadingUsers(false)
    }
  }

  // ── Fetch student names ──────────────────────────────────────
  const fetchStudentNames = async () => {
    try {
      const { data } = await supabase.from('StudentNames').select('*')
      if (data) {
        const map = {}
        data.forEach(d => map[d.rollno] = d.first_name || 'Unknown')
        setStudentNames(map)
      }
    } catch (err) {
      console.error('Error fetching student names:', err)
    }
  }

  // ── Fetch all complaints ─────────────────────────────────────
  const fetchComplaints = async () => {
    try {
      const { data, error } = await supabase
        .from('ComplaintsTable')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setComplaints(data)
    } catch (err) {
      console.error('Error fetching complaints:', err)
    } finally {
      setLoadingComplaints(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchStudentNames()
    fetchComplaints()
  }, [])

  // ── Save credit score ────────────────────────────────────────
  const handleSaveCredit = async (rollno) => {
    const newValue = editedCredits[rollno]
    if (newValue === undefined || newValue === null) return

    const clamped = Math.max(0, Math.min(100, parseInt(newValue, 10)))
    if (isNaN(clamped)) return

    try {
      const { error } = await supabase
        .from('UserTable')
        .update({ social_credit: clamped })
        .eq('rollno', rollno)

      if (error) throw error

      // update local state
      setUsers(prev => prev.map(u => u.rollno === rollno ? { ...u, social_credit: clamped } : u))
      setEditedCredits(prev => { const next = { ...prev }; delete next[rollno]; return next })
      setSavedRows(prev => ({ ...prev, [rollno]: true }))
      setTimeout(() => setSavedRows(prev => { const next = { ...prev }; delete next[rollno]; return next }), 1500)

      showToast(`Credit score updated for ${rollno}`)
    } catch (err) {
      console.error('Error updating credit:', err)
    }
  }

  // ── Toggle complaint status ──────────────────────────────────
  const handleToggleComplaint = async (complaint) => {
    const newStatus = complaint.status === 'open' ? 'resolved' : 'open'
    try {
      const { error } = await supabase
        .from('ComplaintsTable')
        .update({ status: newStatus })
        .eq('id', complaint.id)

      if (error) throw error

      setComplaints(prev => prev.map(c => c.id === complaint.id ? { ...c, status: newStatus } : c))
      if (selectedComplaint?.id === complaint.id) {
        setSelectedComplaint(prev => ({ ...prev, status: newStatus }))
      }
      showToast(newStatus === 'resolved' ? 'Complaint marked as resolved' : 'Complaint re-opened')
    } catch (err) {
      console.error('Error updating complaint:', err)
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // ── Filter users by search ──────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users.filter(u => u.rollno !== '9999') // hide admin from list
    const q = search.toLowerCase()
    return users.filter(u =>
      u.rollno !== '9999' &&
      (u.rollno.toLowerCase().includes(q) ||
       u.username.toLowerCase().includes(q) ||
       (studentNames[u.rollno] || '').toLowerCase().includes(q))
    )
  }, [users, search, studentNames])

  // ── Filter complaints by search ─────────────────────────────
  const filteredComplaints = useMemo(() => {
    if (!search.trim()) return complaints
    const q = search.toLowerCase()
    return complaints.filter(c =>
      c.subject.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      c.rollno.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    )
  }, [complaints, search])

  // ── Format timestamp ────────────────────────────────────────
  const formatTime = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Get username for a rollno ───────────────────────────────
  const getUsernameForRollno = (rollno) => {
    const u = users.find(u => u.rollno === rollno)
    return u ? u.username : rollno
  }

  return (
    <div className="admin-panel" id="admin-panel">
      {/* ── Top bar ── */}
      <header className="admin-topbar" id="admin-topbar">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="admin-topbar-title">🛡️ Admin Panel</span>
          <span className="admin-topbar-badge">
            <Shield size={12} />
            ADMIN
          </span>
        </div>
        <div className="admin-topbar-right">
          <button className="admin-logout-btn" onClick={onLogout} id="admin-logout">
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="admin-tabs" id="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'credits' ? 'active' : ''}`}
          onClick={() => { setActiveTab('credits'); setSearch('') }}
          id="admin-tab-credits"
        >
          <Users size={16} />
          Credit Scores
          <span className="admin-tab-count">{users.filter(u => u.rollno !== '9999').length}</span>
        </button>
        <button
          className={`admin-tab ${activeTab === 'complaints' ? 'active' : ''}`}
          onClick={() => { setActiveTab('complaints'); setSearch('') }}
          id="admin-tab-complaints"
        >
          <MessageSquareWarning size={16} />
          Complaints
          <span className="admin-tab-count">{complaints.filter(c => c.status === 'open').length}</span>
        </button>
      </div>

      {/* ── Content ── */}
      <div className="admin-content" id="admin-content">
        {/* Search */}
        <div className="admin-search-wrapper">
          <Search size={16} className="admin-search-icon" />
          <input
            className="admin-search-input"
            type="text"
            placeholder={activeTab === 'credits' ? 'Search users by rollno, name…' : 'Search complaints…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="admin-search"
          />
        </div>

        {/* ── Credits Tab ── */}
        {activeTab === 'credits' && (
          loadingUsers ? (
            <div className="admin-loading">
              <div className="admin-spinner" />
              <span>Loading users…</span>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="admin-table-container">
              <table className="admin-table" id="admin-credits-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Username</th>
                    <th>Real Name</th>
                    <th>Credit Score</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isEdited = editedCredits[u.rollno] !== undefined
                    const displayValue = isEdited ? editedCredits[u.rollno] : u.social_credit
                    return (
                      <tr key={u.rollno}>
                        <td className="admin-rollno-cell">{u.rollno}</td>
                        <td className="admin-username-cell">@{u.username}</td>
                        <td className="admin-realname-cell">{studentNames[u.rollno] || '—'}</td>
                        <td>
                          <div className="admin-credit-edit">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="admin-credit-input"
                              value={displayValue}
                              onChange={(e) => setEditedCredits(prev => ({
                                ...prev,
                                [u.rollno]: e.target.value
                              }))}
                              id={`credit-input-${u.rollno}`}
                            />
                          </div>
                        </td>
                        <td>
                          <button
                            className={`admin-save-btn ${savedRows[u.rollno] ? 'saved' : ''}`}
                            onClick={() => handleSaveCredit(u.rollno)}
                            title="Save credit score"
                            id={`credit-save-${u.rollno}`}
                            disabled={!isEdited}
                            style={{ opacity: isEdited ? 1 : 0.3 }}
                          >
                            {savedRows[u.rollno] ? <CheckCircle2 size={16} /> : <Save size={16} />}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <div className="admin-empty-icon">👻</div>
              <p>No users found matching "{search}"</p>
            </div>
          )
        )}

        {/* ── Complaints Tab ── */}
        {activeTab === 'complaints' && (
          loadingComplaints ? (
            <div className="admin-loading">
              <div className="admin-spinner" />
              <span>Loading complaints…</span>
            </div>
          ) : filteredComplaints.length > 0 ? (
            <div className="admin-table-container">
              <table className="admin-table" id="admin-complaints-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>From</th>
                    <th>Subject</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Time</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComplaints.map((c) => (
                    <tr
                      key={c.id}
                      className="admin-complaint-row"
                      onClick={() => setSelectedComplaint(c)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ color: '#8b7355', fontWeight: 600 }}>{c.id}</td>
                      <td>
                        <div style={{ fontSize: '13px', color: '#a38568' }}>{c.rollno}</div>
                        <div style={{ fontSize: '15px', color: '#d4b896', fontFamily: "'Caveat', cursive" }}>
                          @{getUsernameForRollno(c.rollno)}
                        </div>
                      </td>
                      <td className="admin-complaint-subject">{c.subject}</td>
                      <td className="admin-complaint-desc">{c.description || '—'}</td>
                      <td>
                        <span className={`admin-status-badge ${c.status}`}>
                          {c.status === 'open' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                          {c.status}
                        </span>
                      </td>
                      <td className="admin-complaint-time">{formatTime(c.created_at)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {c.status === 'open' ? (
                          <button
                            className="admin-resolve-btn"
                            onClick={() => handleToggleComplaint(c)}
                            id={`resolve-btn-${c.id}`}
                          >
                            <CheckCircle2 size={14} />
                            Resolve
                          </button>
                        ) : (
                          <button
                            className="admin-reopen-btn"
                            onClick={() => handleToggleComplaint(c)}
                            id={`reopen-btn-${c.id}`}
                          >
                            <RotateCcw size={14} />
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <div className="admin-empty-icon">🕊️</div>
              <p>{search ? `No complaints matching "${search}"` : 'No complaints yet. Peace and quiet!'}</p>
            </div>
          )
        )}
      </div>

      {/* ── Complaint Detail Popup ── */}
      {selectedComplaint && (
        <div
          className="admin-complaint-detail-overlay"
          onClick={() => setSelectedComplaint(null)}
          id="complaint-detail-overlay"
        >
          <div
            className="admin-complaint-detail"
            onClick={(e) => e.stopPropagation()}
            id="complaint-detail-card"
          >
            <button
              className="admin-complaint-detail-close"
              onClick={() => setSelectedComplaint(null)}
              id="complaint-detail-close"
            >
              <X size={16} />
            </button>

            <h3>{selectedComplaint.subject}</h3>

            <div className="admin-complaint-detail-meta">
              <div className="admin-complaint-detail-user">
                <span>From:</span>
                <strong>@{getUsernameForRollno(selectedComplaint.rollno)}</strong>
                <span>({selectedComplaint.rollno})</span>
              </div>
              <span className={`admin-status-badge ${selectedComplaint.status}`}>
                {selectedComplaint.status === 'open' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                {selectedComplaint.status}
              </span>
            </div>

            <div className="admin-complaint-detail-desc">
              {selectedComplaint.description || 'No description provided.'}
            </div>

            <div style={{ fontSize: '12px', color: '#8b7355', marginBottom: '20px' }}>
              Filed on {formatTime(selectedComplaint.created_at)}
            </div>

            <div className="admin-complaint-detail-actions">
              {selectedComplaint.status === 'open' ? (
                <button
                  className="admin-resolve-btn"
                  onClick={() => handleToggleComplaint(selectedComplaint)}
                  style={{ padding: '10px 20px', fontSize: '14px' }}
                >
                  <CheckCircle2 size={16} />
                  Mark as Resolved
                </button>
              ) : (
                <button
                  className="admin-reopen-btn"
                  onClick={() => handleToggleComplaint(selectedComplaint)}
                  style={{ padding: '10px 20px', fontSize: '14px' }}
                >
                  <RotateCcw size={16} />
                  Reopen Complaint
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="admin-toast">
          <span className="admin-toast-msg">
            <CheckCircle2 size={16} />
            {toast}
          </span>
        </div>
      )}
    </div>
  )
}
