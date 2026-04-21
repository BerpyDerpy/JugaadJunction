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
  Ticket,
  Trash2,
} from 'lucide-react'
import './AdminPanel.css'

// ─── AdminPanel ─────────────────────────────────────────────────
export default function AdminPanel({ user, onLogout, onToggleView }) {
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

  // tickets state
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)

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

  // ── Fetch all tickets ────────────────────────────────────────
  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('TicketTable')
        .select(`
          ticketid, type, owner_rollno, title, category, status, "ItemPrice",
          owner:UserTable!TicketTable_owner_rollno_fkey(username)
        `)
        .order('ticketid', { ascending: false })

      if (error) throw error
      if (data) setTickets(data)
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchStudentNames()
    fetchComplaints()
    fetchTickets()
  }, [])

  // ── Save credit score ────────────────────────────────────────
  const handleSaveCredit = async (rollno) => {
    const newValue = editedCredits[rollno]
    if (newValue === undefined || newValue === null) return

    const clamped = Math.max(-150, Math.min(10000, parseInt(newValue, 10)))
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

  // ── Delete user ───────────────────────────────────────────────
  const [deletingUser, setDeletingUser] = useState(false)
  const handleDeleteUser = async (rollno) => {
    if (!window.confirm(`Delete user ${rollno} and ALL their tickets/complaints? This cannot be undone.`)) return
    setDeletingUser(true)
    try {
      const { error } = await supabase.from('UserTable').delete().eq('rollno', rollno)
      if (error) throw error
      
      setUsers(prev => prev.filter(u => u.rollno !== rollno))
      setTickets(prev => prev.filter(t => t.owner_rollno !== rollno))
      setComplaints(prev => prev.filter(c => c.rollno !== rollno))
      showToast(`User ${rollno} deleted`)
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Failed to delete user')
    } finally {
      setDeletingUser(false)
    }
  }

  // ── Delete ticket ─────────────────────────────────────────────
  const [deletingTicket, setDeletingTicket] = useState(false)
  const handleDeleteTicket = async (ticketid) => {
    if (!window.confirm(`Delete ticket #${ticketid}?`)) return
    setDeletingTicket(true)
    try {
      const { error } = await supabase.from('TicketTable').delete().eq('ticketid', ticketid)
      if (error) throw error
      
      setTickets(prev => prev.filter(t => t.ticketid !== ticketid))
      showToast(`Ticket #${ticketid} deleted`)
    } catch (err) {
      console.error('Error deleting ticket:', err)
      alert('Failed to delete ticket')
    } finally {
      setDeletingTicket(false)
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

  // ── Filter tickets by search ────────────────────────────────
  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets
    const q = search.toLowerCase()
    return tickets.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      t.owner_rollno.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q) ||
      (t.owner?.username || '').toLowerCase().includes(q)
    )
  }, [tickets, search])

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
          {onToggleView && (
            <button className="admin-logout-btn" onClick={onToggleView} style={{ marginRight: '10px' }}>
              <Search size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Marketplace
            </button>
          )}
          <button className="admin-logout-btn" onClick={onLogout} id="admin-logout">
            <LogOut size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
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
        <button
          className={`admin-tab ${activeTab === 'tickets' ? 'active' : ''}`}
          onClick={() => { setActiveTab('tickets'); setSearch('') }}
          id="admin-tab-tickets"
        >
          <Ticket size={16} />
          Tickets
          <span className="admin-tab-count">{tickets.length}</span>
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
                              min="-150"
                              max="10000"
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
                            style={{ opacity: isEdited ? 1 : 0.3, marginRight: '10px' }}
                          >
                            {savedRows[u.rollno] ? <CheckCircle2 size={16} /> : <Save size={16} />}
                          </button>
                          <button
                            className="admin-delete-btn"
                            onClick={() => handleDeleteUser(u.rollno)}
                            disabled={deletingUser}
                            title="Delete User"
                          >
                            <Trash2 size={16} />
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

        {/* ── Tickets Tab ── */}
        {activeTab === 'tickets' && (
          loadingTickets ? (
            <div className="admin-loading">
              <div className="admin-spinner" />
              <span>Loading tickets…</span>
            </div>
          ) : filteredTickets.length > 0 ? (
            <div className="admin-table-container">
              <table className="admin-table" id="admin-tickets-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Owner</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => {
                    const uname = Array.isArray(t.owner) ? t.owner[0]?.username : t.owner?.username;
                    return (
                    <tr key={t.ticketid}>
                      <td style={{ color: '#8b7355', fontWeight: 600 }}>#{t.ticketid}</td>
                      <td>{t.title}</td>
                      <td>@{uname || 'unknown'} <br/><span style={{ fontSize: '11px', color: '#a38568'}}>{t.owner_rollno}</span></td>
                      <td><span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', color: t.type === 'request' ? '#ef4444' : '#22c55e' }}>{t.type}</span></td>
                      <td>
                        <span className={`admin-status-badge ${t.status}`}>
                          {t.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="admin-delete-btn"
                          onClick={() => handleDeleteTicket(t.ticketid)}
                          disabled={deletingTicket}
                          title="Delete Ticket"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty">
              <div className="admin-empty-icon">🎟️</div>
              <p>No tickets found.</p>
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
