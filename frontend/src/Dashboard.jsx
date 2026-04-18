import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import {
  X,
  Bell,
  ShoppingBag,
  Package,
  Megaphone,
  Hand,
  CheckCircle2,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import './Dashboard.css'

// ── Card styling helpers (same as Marketplace) ─────────────────
const CARD_VARIANTS = ['variant-cream', 'variant-blue', 'variant-yellow', 'variant-pink', 'variant-green']
const PIN_COLORS = ['pin-red', 'pin-yellow', 'pin-green', 'pin-blue', 'pin-orange']
function pick(arr, i) { return arr[i % arr.length] }

// ── Credit Score Wheel ─────────────────────────────────────────
function CreditWheel({ score, max = 100 }) {
  ``
  const radius = 38
  const stroke = 7
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(score / max, 1)
  const offset = circumference * (1 - pct)

  // color based on score
  let color = '#ef4444' // red
  if (pct > 0.7) color = '#22c55e' // green
  else if (pct > 0.4) color = '#eab308' // yellow

  return (
    <div className="db-credit-wheel" id="credit-score-wheel">
      <svg viewBox="0 0 100 100" className="db-credit-svg">
        {/* background track */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke="rgba(245,230,211,0.12)"
          strokeWidth={stroke}
        />
        {/* score arc */}
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

// ── Ticket Card (matches Marketplace exactly) ──────────────────
function DashTicketCard({ ticket, index, type, onClick }) {
  const showTape = index % 4 === 1
  const showStain = index % 5 === 3

  return (
    <div
      className={`mp-ticket ${pick(CARD_VARIANTS, index)} mp-ticket-clickable`}
      style={{ animationDelay: `${index * 0.06}s` }}
      id={`dash-ticket-${ticket.id}`}
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

// ── Dashboard Component ────────────────────────────────────────
export default function Dashboard({ user, onClose, onNavigateMarketplace }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posted') // 'posted' | 'requested'
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [socialCredit, setSocialCredit] = useState(user?.social_credit ?? 75)

  useEffect(() => {
    fetchUserTickets()
    fetchSocialCredit()
  }, [])

  const fetchSocialCredit = async () => {
    try {
      const { data, error } = await supabase
        .from('UserTable')
        .select('social_credit')
        .eq('rollno', user.rollno)
        .single()
      if (!error && data) {
        setSocialCredit(data.social_credit)
      }
    } catch (err) {
      console.error('Error fetching social credit:', err)
    }
  }

  const fetchUserTickets = async () => {
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
        .or(`owner_rollno.eq.${user.rollno},claimant_rollno.eq.${user.rollno}`)

      if (error) throw error

      if (data) {
        const formatted = data.map(t => {
          const ownerObj = Array.isArray(t.owner) ? t.owner[0] : t.owner
          const username = ownerObj ? ownerObj.username : 'unknown'
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
            status: meta.status || 'pending',
            type: t.type || 'request',
          }
        })
        setTickets(formatted.reverse())
      }
    } catch (err) {
      console.error('Error fetching user tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const posted = useMemo(
    () => tickets.filter(t => t.type === 'post' && t.ownerRollno === user.rollno),
    [tickets, user.rollno]
  )
  const requested = useMemo(
    () => tickets.filter(t => t.type === 'request' && t.ownerRollno === user.rollno),
    [tickets, user.rollno]
  )
  const claimed = useMemo(
    () => tickets.filter(t => t.claimantRollno === user.rollno && t.ownerRollno !== user.rollno),
    [tickets, user.rollno]
  )

  const activeList = activeTab === 'posted' ? posted : activeTab === 'requested' ? requested : claimed
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??'

  const isClaimed = selectedTicket?.status === 'claimed'
  const isOwner = selectedTicket?.ownerRollno === user.rollno

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
      await fetchUserTickets()
    } catch (err) {
      console.error('Error deleting ticket:', err)
      alert('Failed to delete ticket')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="db-overlay" id="dashboard-overlay" onClick={onClose}>
      <div className="db-panel" onClick={e => e.stopPropagation()} id="dashboard-panel">
        {/* ── Close button ── */}
        <button className="db-close-btn" onClick={onClose} id="dashboard-close">
          <X size={18} />
        </button>

        {/* ── User header with credit wheel ── */}
        <div className="db-user-header" id="dashboard-user-header">
          <div className="db-avatar">{initials}</div>
          <div className="db-user-info">
            <h2 className="db-username">@{user?.username || 'anon'}</h2>
            <span className="db-rollno">{user?.rollno}</span>
          </div>
          <CreditWheel score={socialCredit} />
        </div>

        {/* ── Quick Nav Buttons ── */}
        <div className="db-nav-row" id="dashboard-nav-row">
          <button
            className="db-nav-btn"
            onClick={() => { onClose(); }}
            id="nav-notifications"
          >
            <Bell size={16} />
            <span>Notifications</span>
          </button>
          <button
            className="db-nav-btn"
            onClick={() => { onClose(); if (onNavigateMarketplace) onNavigateMarketplace(); }}
            id="nav-marketplace"
          >
            <ShoppingBag size={16} />
            <span>Marketplace</span>
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="db-tabs" id="dashboard-tabs">
          <button
            className={`db-tab ${activeTab === 'posted' ? 'active' : ''}`}
            onClick={() => setActiveTab('posted')}
            id="tab-posted"
          >
            <Package size={16} />
            Offers ({posted.length})
          </button>
          <button
            className={`db-tab ${activeTab === 'requested' ? 'active' : ''}`}
            onClick={() => setActiveTab('requested')}
            id="tab-requested"
          >
            <Megaphone size={16} />
            Requested ({requested.length})
          </button>
          <button
            className={`db-tab ${activeTab === 'claimed' ? 'active' : ''}`}
            onClick={() => setActiveTab('claimed')}
            id="tab-claimed"
          >
            <Hand size={16} />
            Claimed ({claimed.length})
          </button>
        </div>

        {/* ── Ticket list ── */}
        <div className="db-tickets" id="dashboard-tickets">
          {loading ? (
            <div className="db-loading">
              <div className="db-spinner" />
              <span>Loading your tickets…</span>
            </div>
          ) : activeList.length > 0 ? (
            <div className="db-ticket-grid">
              {activeList.map((t, i) => (
                <DashTicketCard
                  key={t.id}
                  ticket={t}
                  index={i}
                  type={t.type}
                  onClick={setSelectedTicket}
                />
              ))}
            </div>
          ) : (
            <div className="db-empty">
              <div className="db-empty-icon">
                {activeTab === 'posted' ? '📦' : activeTab === 'requested' ? '📣' : '🤝'}
              </div>
              <p>
                {activeTab === 'posted'
                  ? "You haven't posted any offers yet."
                  : activeTab === 'requested'
                  ? "You haven't made any requests yet."
                  : "You haven't claimed any tickets yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Ticket Detail Popup (inside Dashboard overlay) ── */}
      {selectedTicket && (
        <div
          className="mp-modal-overlay"
          onClick={() => setSelectedTicket(null)}
          id="dash-ticket-detail-overlay"
          style={{ zIndex: 400 }}
        >
          <div
            className={`mp-detail-popup ${isClaimed ? 'detail-claimed' : ''}`}
            onClick={(e) => e.stopPropagation()}
            id="dash-ticket-detail-card"
          >
            <div className="mp-detail-pin" />

            <button
              className="mp-modal-close mp-detail-close"
              onClick={() => setSelectedTicket(null)}
              id="dash-ticket-detail-close"
            >
              <X size={16} />
            </button>

            <span className={`mp-detail-type-badge ${selectedTicket.type === 'request' ? 'request-type' : 'seller-type'}`}>
              {selectedTicket.type === 'request' ? 'Request' : 'Offer'}
            </span>

            <div className="mp-detail-header">
              <div className="mp-detail-id">{selectedTicket.id}</div>
              <h2 className="mp-detail-title">{selectedTicket.title}</h2>
            </div>

            <p className="mp-detail-desc">{selectedTicket.desc || 'No description provided.'}</p>

            <div className="mp-detail-meta">
              <span className="mp-detail-category">{selectedTicket.category}</span>
              <span className={`mp-status ${selectedTicket.status}`}>{selectedTicket.status}</span>
            </div>

            <div className="mp-detail-divider" />

            <div className="mp-detail-user-row">
              <span className="mp-ticket-user-dot" />
              <span className="mp-detail-posted-by">
                Posted by <strong>@{selectedTicket.user}</strong>
              </span>
            </div>

            {isClaimed && (
              <div className="mp-detail-claimed-banner">
                <CheckCircle2 size={20} className="mp-detail-claimed-icon" />
                <div className="mp-detail-claimed-text">
                  <strong>This ticket has been claimed!</strong>
                  <span className="mp-detail-claimed-sub">
                    {selectedTicket.claimantRollno === user.rollno && selectedTicket.ownerRollno !== user.rollno
                      ? "You have claimed this ticket!"
                      : "Someone has claimed your ticket. Connect with them!"}
                  </span>
                </div>
              </div>
            )}

            <div className="mp-detail-actions">
              {!isClaimed && (
                <div className="mp-detail-owner-note">
                  <AlertTriangle size={16} />
                  <span>This is your ticket — waiting for someone to claim it.</span>
                </div>
              )}
              {isClaimed && (
                <div className="mp-detail-owner-note success">
                  <CheckCircle2 size={16} />
                  <span>
                    {selectedTicket.claimantRollno === user.rollno && selectedTicket.ownerRollno !== user.rollno
                      ? `You claimed this ticket! Reach out to @${selectedTicket.user} to finalize.`
                      : "Your ticket has been claimed! Connect with the claimant."}
                  </span>
                </div>
              )}

              {isOwner && (
                <button
                  className="mp-detail-claim-btn"
                  onClick={() => handleDelete(selectedTicket)}
                  disabled={deleting}
                  id="dash-delete-ticket-btn"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', marginTop: '12px', width: '100%', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px', fontWeight: '500' }}
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
    </div>
  )
}
