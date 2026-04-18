import { useState, useMemo, useEffect } from 'react'
import { supabase } from './supabaseClient'
import {
  Search,
  Plus,
  ShoppingBag,
  Hand,
  X,
  LogOut,
  Package,
  Megaphone,
  CheckCircle2,
  Gavel,
  AlertTriangle,
  XCircle,
  Lock,
  Trash2,
} from 'lucide-react'
import Dashboard from './Dashboard'
import { usePushNotifications } from './usePushNotifications'
import './Marketplace.css'

// ─── Filter categories ──────────────────────────────────────────
const CATEGORIES = [
  'All',
  'Record Stuff',
  'A4',
  'Output Printouts',
  'Stationery',
  'Charging Equipment',
  'Snacks',
  'Adaptors',
  'Water Bottle',
  'Homework & Assignments',
  'Attendance',
  'Short Notes',
  'Leisure Buddy System',
]

// ─── Dummy ticket data removed since we fetch from DB ─────────────

// Helpers for styling variety
const CARD_VARIANTS = ['variant-cream', 'variant-blue', 'variant-yellow', 'variant-pink', 'variant-green']
const PIN_COLORS   = ['pin-red', 'pin-yellow', 'pin-green', 'pin-blue', 'pin-orange']

function pick(arr, i) {
  return arr[i % arr.length]
}

// ─── TicketCard ─────────────────────────────────────────────────
function TicketCard({ ticket, index, type, onClick }) {
  const showTape  = index % 4 === 1
  const showStain = index % 5 === 3

  return (
    <div
      className={`mp-ticket ${pick(CARD_VARIANTS, index)} mp-ticket-clickable`}
      style={{ animationDelay: `${index * 0.06}s` }}
      id={`ticket-${ticket.id}`}
      onClick={() => onClick && onClick(ticket)}
    >
      <div className={`mp-pin ${pick(PIN_COLORS, index)}`} />
      {showTape && <div className={`mp-tape ${index % 2 === 0 ? '' : 'tape-left'}`} />}
      {showStain && <div className="mp-stain" />}

      <span className={`mp-ticket-type ${type === 'request' ? 'request-type' : 'seller-type'}`}>
        {type === 'request' ? 'Request' : 'Offer'}
      </span>

      <div className="mp-ticket-id">{ticket.id}</div>
      <div className="mp-ticket-title">{ticket.title}</div>
      <div className="mp-ticket-desc">{ticket.desc}</div>

      <span className="mp-ticket-category">{ticket.category}</span>

      <div className="mp-ticket-footer">
        <span className="mp-ticket-user">
          <span className="mp-ticket-user-dot" />
          @{ticket.user}
        </span>
        <span className={`mp-status ${ticket.status}`}>{ticket.status}</span>
      </div>
    </div>
  )
}

// ─── Marketplace ────────────────────────────────────────────────
export default function Marketplace({ user, onLogout }) {
  // Setup push notifications based on user
  usePushNotifications(user?.rollno)

  // filter / search state
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery]   = useState('')

  // dashboard state
  const [dashboardOpen, setDashboardOpen] = useState(false)

  // modal state (create ticket)
  const [modalOpen, setModalOpen] = useState(null) // 'request' | 'seller' | null
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc]   = useState('')
  const [formCategory, setFormCategory] = useState('')

  // ticket detail popup state
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [claiming, setClaiming] = useState(false)

  // ticket state
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('TicketTable')
        .select(`
          ticketid,
          type,
          owner_rollno,
          claimant_rollno,
          owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
          claimant:UserTable!TicketTable_claimant_rollno_fkey ( username ),
          metadata:TicketTableData ( title, description, category, status )
        `)
      
      if (error) throw error

      if (data) {
        const formattedTickets = data.map(t => {
          const ownerObj = Array.isArray(t.owner) ? t.owner[0] : t.owner
          const username = ownerObj ? ownerObj.username : 'unknown'
          const claimantObj = Array.isArray(t.claimant) ? t.claimant[0] : t.claimant
          const claimantUsername = claimantObj ? claimantObj.username : null
          const meta = Array.isArray(t.metadata) ? t.metadata[0] : t.metadata || {}

          return {
            id: String(t.type === 'request' ? 'REQ-' : 'SEL-') + t.ticketid,
            ticketid: t.ticketid,
            title: meta.title || 'Untitled',
            desc: meta.description || '',
            category: meta.category || 'General',
            user: username,
            ownerRollno: t.owner_rollno,
            claimantRollno: t.claimant_rollno,
            claimantUser: claimantUsername,
            status: meta.status || 'pending',
            type: t.type || 'request'
          }
        })
        setTickets(formattedTickets.reverse())
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const closeModal = () => {
    setModalOpen(null)
    setFormTitle('')
    setFormDesc('')
    setFormCategory('')
  }

  const handleSubmit = async () => {
    if (!formTitle || !formCategory) {
      alert("Please fill in title and category")
      return
    }

    try {
      const dbType = modalOpen === 'seller' ? 'post' : 'request'
      
      const { data: ticketData, error: ticketError } = await supabase
        .from('TicketTable')
        .insert({
          owner_rollno: user.rollno,
          type: dbType
        })
        .select('ticketid')
        .single()
      
      if (ticketError) throw ticketError

      const { error: metaError } = await supabase
        .from('TicketTableData')
        .insert({
          ticketid: ticketData.ticketid,
          title: formTitle,
          description: formDesc,
          category: formCategory,
          status: 'pending'
        })
      
      if (metaError) throw metaError

      closeModal()
      fetchTickets()
    } catch (err) {
      console.error("Error creating ticket:", err)
      alert("Failed to create ticket")
    }
  }

  // ─── Claim ticket handler ──────────────────────────────────────
  const handleClaim = async (ticket) => {
    if (claiming) return
    setClaiming(true)

    try {
      // Update status in TicketTableData
      const { error: metaError } = await supabase
        .from('TicketTableData')
        .update({ status: 'claimed' })
        .eq('ticketid', ticket.ticketid)

      if (metaError) throw metaError

      // Update claimant in TicketTable
      const { error: ticketError } = await supabase
        .from('TicketTable')
        .update({ claimant_rollno: user.rollno })
        .eq('ticketid', ticket.ticketid)

      if (ticketError) throw ticketError

      // Refresh ticket list and update the selected ticket in the popup
      await fetchTickets()

      // Update selected ticket locally so the popup reflects the change instantly
      setSelectedTicket(prev => prev ? {
        ...prev,
        status: 'claimed',
        claimantRollno: user.rollno,
        claimantUser: user.username,
      } : null)
    } catch (err) {
      console.error('Error claiming ticket:', err)
      alert('Failed to claim ticket')
    } finally {
      setClaiming(false)
    }
  }

  // filtering logic
  const filterTickets = (tickets) => {
    return tickets.filter((t) => {
      if (t.status === 'closed') return false
      const matchesCategory =
        activeFilter === 'All' || t.category === activeFilter
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.user.toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    })
  }

  const filteredRequests = useMemo(
    () => filterTickets(tickets.filter(t => t.type === 'request')),
    [activeFilter, searchQuery, tickets]
  )
  const filteredSeller = useMemo(
    () => filterTickets(tickets.filter(t => t.type === 'post')),
    [activeFilter, searchQuery, tickets]
  )

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??'

  // ─── Delete ticket handler ──────────────────────────────────────
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (ticket) => {
    if (!window.confirm("Are you sure you want to delete this ticket FOREVER?")) return;
    if (deleting) return
    setDeleting(true)
    try {
      const { error: metaError } = await supabase
        .from('TicketTableData')
        .delete()
        .eq('ticketid', ticket.ticketid)
      if (metaError) throw metaError

      const { error: ticketError } = await supabase
        .from('TicketTable')
        .delete()
        .eq('ticketid', ticket.ticketid)
      if (ticketError) throw ticketError

      setSelectedTicket(null)
      await fetchTickets()
    } catch (err) {
      console.error('Error deleting ticket:', err)
      alert('Failed to delete ticket')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Close ticket handler ──────────────────────────────────────
  const [closing, setClosing] = useState(false)

  const handleClose = async (ticket) => {
    if (closing) return
    setClosing(true)
    try {
      const { error } = await supabase
        .from('TicketTableData')
        .update({ status: 'closed' })
        .eq('ticketid', ticket.ticketid)

      if (error) throw error

      await fetchTickets()
      setSelectedTicket(prev => prev ? { ...prev, status: 'closed' } : null)
    } catch (err) {
      console.error('Error closing ticket:', err)
      alert('Failed to close ticket')
    } finally {
      setClosing(false)
    }
  }

  // Determine popup state for selected ticket
  const isOwner = selectedTicket?.ownerRollno === user.rollno
  const isClaimed = selectedTicket?.status === 'claimed'
  const isClosed = selectedTicket?.status === 'closed'
  const isClaimant = selectedTicket?.claimantRollno === user.rollno

  return (
    <div className="marketplace" id="marketplace-root">
      {/* ── Top bar ── */}
      <header className="mp-topbar" id="marketplace-topbar">
        <span className="mp-topbar-title">📌 Jugaad Junction</span>

        <div className="mp-topbar-user">
          <button className="mp-logout-btn" onClick={onLogout} id="logout-btn">
            <LogOut size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Log out
          </button>
          <div
            className="mp-topbar-avatar"
            id="user-avatar"
            onClick={() => setDashboardOpen(true)}
            style={{ cursor: 'pointer' }}
            title="Open Dashboard"
          >{initials}</div>
          <span>@{user?.username || 'anon'}</span>
        </div>
      </header>

      {/* ── Search ── */}
      <div className="mp-search-wrapper" style={{ marginTop: 16 }}>
        <Search size={16} className="mp-search-icon" />
        <input
          id="marketplace-search"
          className="mp-search-input"
          type="text"
          placeholder="Search tickets, users, items…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ── Category filters ── */}
      <div className="mp-filter-bar" id="marketplace-filters">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`mp-filter-pill ${activeFilter === cat ? 'active' : ''}`}
            onClick={() => setActiveFilter(cat)}
            id={`filter-${cat.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Board ── */}
      <main className="mp-board">
        {/* Requests section */}
        <section className="mp-section" id="section-requests">
          <div className="mp-section-header">
            <div className="mp-section-icon requests">
              <Megaphone size={20} />
            </div>
            <h2 className="mp-section-title">
              Requests
              <span className="mp-section-count">({filteredRequests.length})</span>
            </h2>
          </div>

          {filteredRequests.length > 0 ? (
            <div className="mp-ticket-grid">
              {filteredRequests.map((t, i) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  type="request"
                  onClick={setSelectedTicket}
                />
              ))}
            </div>
          ) : (
            <div className="mp-empty">
              <div className="mp-empty-icon">🦗</div>
              No request tickets match your filter.
            </div>
          )}
        </section>

        {/* Seller Posts section */}
        <section className="mp-section" id="section-seller">
          <div className="mp-section-header">
            <div className="mp-section-icon seller">
              <Package size={20} />
            </div>
            <h2 className="mp-section-title">
              Seller Posts
              <span className="mp-section-count">({filteredSeller.length})</span>
            </h2>
          </div>

          {filteredSeller.length > 0 ? (
            <div className="mp-ticket-grid">
              {filteredSeller.map((t, i) => (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  type="seller"
                  onClick={setSelectedTicket}
                />
              ))}
            </div>
          ) : (
            <div className="mp-empty">
              <div className="mp-empty-icon">🏜️</div>
              No seller posts match your filter.
            </div>
          )}
        </section>
      </main>

      {/* ── FABs ── */}
      <div className="mp-fab-container" id="marketplace-fabs">
        <button
          className="mp-fab request"
          onClick={() => setModalOpen('request')}
          id="fab-request"
        >
          <Hand size={20} />
          Request
        </button>
        <button
          className="mp-fab post"
          onClick={() => setModalOpen('seller')}
          id="fab-post"
        >
          <Plus size={20} />
          Post
        </button>
      </div>

      {/* ── Create Ticket Modal ── */}
      {modalOpen && (
        <div className="mp-modal-overlay" onClick={closeModal} id="modal-overlay">
          <div
            className={`mp-modal ${modalOpen === 'request' ? 'request-modal' : 'seller-modal'}`}
            onClick={(e) => e.stopPropagation()}
            id="modal-card"
          >
            <div className="mp-modal-header">
              <h3 className="mp-modal-title">
                {modalOpen === 'request'
                  ? '📣 Submit a Request'
                  : '📦 Post an Offer'}
              </h3>
              <button className="mp-modal-close" onClick={closeModal} id="modal-close">
                <X size={16} />
              </button>
            </div>

            <div className="mp-modal-body">
              <div>
                <label className="mp-modal-label" htmlFor="modal-title-input">
                  Item / Title
                </label>
                <input
                  id="modal-title-input"
                  className="mp-modal-input"
                  type="text"
                  placeholder="e.g. Need 5 A4 sheets near library"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="mp-modal-label" htmlFor="modal-desc-input">
                  Description
                </label>
                <textarea
                  id="modal-desc-input"
                  className="mp-modal-textarea"
                  placeholder="Any extra details — urgency, location, price…"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="mp-modal-label" htmlFor="modal-category-select">
                  Category
                </label>
                <select
                  id="modal-category-select"
                  className="mp-modal-select"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  <option value="">Pick a category…</option>
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className={`mp-modal-submit ${
                  modalOpen === 'request' ? 'request-submit' : 'seller-submit'
                }`}
                onClick={handleSubmit}
                id="modal-submit-btn"
              >
                {modalOpen === 'request' ? 'Submit Request' : 'Publish Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ticket Detail Popup ── */}
      {selectedTicket && (
        <div
          className="mp-modal-overlay"
          onClick={() => setSelectedTicket(null)}
          id="ticket-detail-overlay"
        >
          <div
            className={`mp-detail-popup ${isClaimed ? 'detail-claimed' : ''} ${isClosed ? 'detail-closed' : ''}`}
            onClick={(e) => e.stopPropagation()}
            id="ticket-detail-card"
          >
            {/* Decorative pin */}
            <div className="mp-detail-pin" />

            <button
              className="mp-modal-close mp-detail-close"
              onClick={() => setSelectedTicket(null)}
              id="ticket-detail-close"
            >
              <X size={16} />
            </button>

            {/* Type badge */}
            <span className={`mp-detail-type-badge ${selectedTicket.type === 'request' ? 'request-type' : 'seller-type'}`}>
              {selectedTicket.type === 'request' ? 'Request' : 'Offer'}
            </span>

            {/* Header zone */}
            <div className="mp-detail-header">
              <div className="mp-detail-id">{selectedTicket.id}</div>
              <h2 className="mp-detail-title">{selectedTicket.title}</h2>
            </div>

            {/* Description */}
            <p className="mp-detail-desc">{selectedTicket.desc || 'No description provided.'}</p>

            {/* Metadata row */}
            <div className="mp-detail-meta">
              <span className="mp-detail-category">{selectedTicket.category}</span>
              <span className={`mp-status ${selectedTicket.status}`}>{selectedTicket.status}</span>
            </div>

            <div className="mp-detail-divider" />

            {/* Posted by */}
            <div className="mp-detail-user-row">
              <span className="mp-ticket-user-dot" />
              <span className="mp-detail-posted-by">
                Posted by <strong>@{selectedTicket.user}</strong>
              </span>
            </div>

            {/* ── Claimed state ── */}
            {isClaimed && (
              <div className="mp-detail-claimed-banner" id="claimed-banner">
                <CheckCircle2 size={20} className="mp-detail-claimed-icon" />
                <div className="mp-detail-claimed-text">
                  <strong>This ticket has been claimed!</strong>
                  {isClaimant ? (
                    <span className="mp-detail-claimed-sub">You claimed this ticket.</span>
                  ) : (
                    <span className="mp-detail-claimed-sub">
                      @{selectedTicket.claimantUser || 'Someone'} already grabbed this one.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Bargain prompt for non-claimants on claimed tickets ── */}
            {isClaimed && !isClaimant && !isOwner && (
              <div className="mp-detail-bargain" id="bargain-section">
                <Gavel size={18} className="mp-detail-bargain-icon" />
                <div className="mp-detail-bargain-text">
                  <strong>Got a better deal?</strong>
                  <span>Reach out to @{selectedTicket.user} and offer a bargain!</span>
                </div>
              </div>
            )}

            {/* ── Closed state banner ── */}
            {isClosed && (
              <div className="mp-detail-closed-banner" id="closed-banner">
                <Lock size={20} className="mp-detail-closed-icon" />
                <div className="mp-detail-closed-text">
                  <strong>This ticket is closed.</strong>
                  <span className="mp-detail-closed-sub">
                    {isOwner ? 'You marked this deal as done. 🎉' : 'The owner has closed this ticket.'}
                  </span>
                </div>
              </div>
            )}

            {/* ── Action area ── */}
            <div className="mp-detail-actions">
              {!isClaimed && !isClosed && !isOwner && (
                <button
                  className="mp-detail-claim-btn"
                  onClick={() => handleClaim(selectedTicket)}
                  disabled={claiming}
                  id="claim-ticket-btn"
                >
                  {claiming ? (
                    <>
                      <div className="mp-detail-btn-spinner" />
                      Claiming…
                    </>
                  ) : (
                    <>
                      <Hand size={18} />
                      Claim this Ticket
                    </>
                  )}
                </button>
              )}

              {isOwner && !isClaimed && !isClosed && (
                <div className="mp-detail-owner-note">
                  <AlertTriangle size={16} />
                  <span>This is your ticket — waiting for someone to claim it.</span>
                </div>
              )}

              {isOwner && isClaimed && !isClosed && (
                <div className="mp-detail-owner-claimed-actions">
                  <div className="mp-detail-owner-note success">
                    <CheckCircle2 size={16} />
                    <span>Claimed by @{selectedTicket.claimantUser || 'Someone'}! Connect with them.</span>
                  </div>
                  <button
                    className="mp-detail-close-ticket-btn"
                    onClick={() => handleClose(selectedTicket)}
                    disabled={closing}
                    id="close-ticket-btn"
                  >
                    {closing ? (
                      <>
                        <div className="mp-detail-btn-spinner" />
                        Closing…
                      </>
                    ) : (
                      <>
                        <XCircle size={18} />
                        Mark as Closed
                      </>
                    )}
                  </button>
                </div>
              )}

              {isClosed && !isOwner && (
                <div className="mp-detail-owner-note">
                  <Lock size={16} />
                  <span>This ticket has been closed by the owner.</span>
                </div>
              )}

              {isOwner && (
                <button
                  className="mp-detail-claim-btn"
                  onClick={() => handleDelete(selectedTicket)}
                  disabled={deleting}
                  id="delete-ticket-btn"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', marginTop: '12px' }}
                >
                  {deleting ? (
                    <>
                      <div className="mp-detail-btn-spinner" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Delete Ticket Forever
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard Panel ── */}
      {dashboardOpen && (
        <Dashboard
          user={user}
          onClose={() => setDashboardOpen(false)}
          onNavigateMarketplace={() => setDashboardOpen(false)}
        />
      )}
    </div>
  )
}
