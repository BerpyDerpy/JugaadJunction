import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { usePushNotifications } from './usePushNotifications'
import {
  X,
  Bell,
  BellRing,
  BellOff,
  ShoppingBag,
  Package,
  Megaphone,
  Hand,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Undo2,
  MessageSquareWarning,
  Send,
  UserCircle,
  Smartphone,
} from 'lucide-react'
import React from 'react'
import { playPop, playClose, playClaim } from './sounds'
import { notifyTicketUnclaimed } from './pushNotificationHelper'
import NameTag from './NameTag'
import './Dashboard.css'

// ── Card styling helpers (same as Marketplace) ─────────────────
const CARD_VARIANTS = ['variant-cream', 'variant-blue', 'variant-yellow', 'variant-pink', 'variant-green']
const PIN_COLORS = ['pin-red', 'pin-yellow', 'pin-green', 'pin-blue', 'pin-orange']
function pick(arr, i) { return arr[i % arr.length] }

// ── Credit Score Wheel ─────────────────────────────────────────
function CreditWheel({ score, max = 10000, min = -150 }) {
  const radius = 38
  const stroke = 7
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min((score - min) / (max - min), 1))
  const offset = circumference * (1 - pct)

  // color based on absolute score thresholds
  let color = '#ef4444' // red
  if (score >= 70) color = '#22c55e' // green
  else if (score >= 30) color = '#eab308' // yellow

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
function DashTicketCard({ ticket, index, type, onClick, studentNames, user }) {
  const showTape = index % 4 === 1
  const showStain = index % 5 === 3

  const hasClaimed = user && ticket.claims?.some(c => c.claimant_rollno === user.rollno)
  const displayStatus = (hasClaimed && ticket.status !== 'closed') ? 'claimed' : ticket.status

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
        <span className={`mp-status ${displayStatus}`}>{displayStatus}</span>
      </div>
    </div>
  )
}

// ── Dashboard Component ────────────────────────────────────────
// ── Notification enable success messages ───────────────────────
const NOTIF_ENABLED_MESSAGES = [
  "🔔 You're in the loop now! We'll ping you when jugaad happens.",
  "📬 Notifications ON! Your phone is now a jugaad radar.",
  "🎯 Notifications enabled! You'll never miss a ticket again.",
  "⚡ Boom! Push notifications activated. Stay sharp!",
  "🤝 You subscribed! Now the jugaad comes to you.",
]

const NOTIF_DENIED_MESSAGES = [
  "🚫 Notifications blocked! Check your browser settings to unblock.",
  "🙈 You denied notifications. We promise we won't spam… much.",
  "🔇 Can't enable — your browser says no. Change it in settings!",
]

export default function Dashboard({ user, onClose, onNavigateMarketplace }) {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([]) // owned tickets
  const [claimedTickets, setClaimedTickets] = useState([]) // tickets claimed by user
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('posted') // 'posted' | 'requested' | 'claimed'
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [socialCredit, setSocialCredit] = useState(user?.social_credit ?? 75)
  const [studentNames, setStudentNames] = useState({})
  const [toast, setToast] = useState(null)
  const [closedAlertTicket, setClosedAlertTicket] = useState(null)
  const [unclaiming, setUnclaiming] = useState(false)

  // notification state
  const { isSupported, permissionStatus, subscription, subscribe, unsubscribe, loading: notifLoading, needsInstall, isIos } = usePushNotifications(user?.rollno)

  // iOS install banner state
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  // complaint modal state
  const [complaintOpen, setComplaintOpen] = useState(false)
  const [complaintSubject, setComplaintSubject] = useState('')
  const [complaintDesc, setComplaintDesc] = useState('')
  const [submittingComplaint, setSubmittingComplaint] = useState(false)

  useEffect(() => {
    const fetchNames = async () => {
      const { data } = await supabase.from('StudentNames').select('*')
      if (data) {
        const map = {}
        data.forEach(d => map[d.rollno] = d.first_name || d.real_name || 'Unknown')
        setStudentNames(map)
      }
    }
    fetchNames()
    fetchUserTickets()
    fetchSocialCredit()
    const channel = supabase.channel('dashboard_actions')
      .on('broadcast', { event: 'ticket_action' }, () => {
        fetchUserTickets()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
      // Fetch tickets user owns (Posted / Requested)
      const { data: ownedData, error: ownedError } = await supabase
        .from('TicketTable')
        .select(`
          ticketid, type, owner_rollno, claimant_rollno,
          owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
          claimant:UserTable!TicketTable_claimant_rollno_fkey ( username ),
          claims:TicketClaims ( claimant_rollno, UserTable ( username ) ),
          title, description, category, status, "ItemPrice"
        `)
        .eq('owner_rollno', user.rollno)

      if (ownedError) throw ownedError

      if (ownedData) {
        setTickets(ownedData.map(formatter).reverse())
      }

      // Fetch tickets user claimed
      const { data: claimsData, error: claimsError } = await supabase
        .from('TicketClaims')
        .select(`
          ticket:TicketTable!inner (
            ticketid, type, owner_rollno, claimant_rollno,
            owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
            claimant:UserTable!TicketTable_claimant_rollno_fkey ( username ),
            claims:TicketClaims ( claimant_rollno, UserTable ( username ) ),
            title, description, category, status, "ItemPrice"
          )
        `)
        .eq('claimant_rollno', user.rollno)

      if (claimsError) throw claimsError

      if (claimsData) {
        const unwrappedClaims = claimsData.map(c => Array.isArray(c.ticket) ? c.ticket[0] : c.ticket).filter(Boolean)
        setClaimedTickets(unwrappedClaims.map(formatter).reverse())
      }
    } catch (err) {
      console.error('Error fetching user tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatter = (t) => {
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
      claims: t.claims || []
    }
  }

  const posted = useMemo(
    () => tickets.filter(t => t.type === 'post'),
    [tickets]
  )
  const requested = useMemo(
    () => tickets.filter(t => t.type === 'request'),
    [tickets]
  )
  const claimed = useMemo(
    () => claimedTickets,
    [claimedTickets]
  )

  useEffect(() => {
    if (selectedTicket) {
      const allTix = [...tickets, ...claimedTickets]
      const t = allTix.find(x => x.ticketid === selectedTicket.ticketid)
      if (t && JSON.stringify(t) !== JSON.stringify(selectedTicket)) {
        setSelectedTicket(t)
      }
    }
  }, [tickets, claimedTickets, selectedTicket])

  const activeList = activeTab === 'posted' ? posted : activeTab === 'requested' ? requested : claimed
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??'

  const hasClaimed = selectedTicket?.claims?.some(c => c.claimant_rollno === user.rollno) || false
  const isOwner = selectedTicket?.ownerRollno === user.rollno
  const isClosed = selectedTicket?.status === 'closed'

  const [deleting, setDeleting] = useState(false)

  const handleDelete = async (ticket) => {
    if (!window.confirm("Are you sure you want to delete this ticket FOREVER?")) return;
    if (deleting) return
    setDeleting(true)
    try {
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

  // ── Toggle notifications handler ─────────────────────────────
  const handleToggleNotifications = async () => {
    if (notifLoading) return

    // iOS users who haven't installed the PWA — show install guide instead
    if (needsInstall) {
      playPop()
      setShowInstallGuide(true)
      return
    }

    // Denied — can't re-prompt
    if (permissionStatus === 'denied') {
      playPop()
      const msg = NOTIF_DENIED_MESSAGES[Math.floor(Math.random() * NOTIF_DENIED_MESSAGES.length)]
      setToast(msg)
      setTimeout(() => setToast(null), 3200)
      return
    }

    if (subscription) {
      // Unsubscribe
      const success = await unsubscribe()
      if (success) {
        playClose()
        setToast("🔕 Notifications successfully disabled.")
        setTimeout(() => setToast(null), 3200)
      } else {
        setToast("⚠️ Failed to disable notifications.")
        setTimeout(() => setToast(null), 3200)
      }
    } else {
      // Subscribe
      const success = await subscribe()
      if (success) {
        playPop()
        const msg = NOTIF_ENABLED_MESSAGES[Math.floor(Math.random() * NOTIF_ENABLED_MESSAGES.length)]
        setToast(msg)
        setTimeout(() => setToast(null), 3200)
      } else {
        setToast("⚠️ Failed to enable notifications.")
        setTimeout(() => setToast(null), 3200)
      }
    }
  }

  // ── Submit complaint handler ────────────────────────────────
  const handleSubmitComplaint = async () => {
    if (!complaintSubject.trim()) {
      alert('Please enter a subject for your complaint.')
      return
    }
    if (submittingComplaint) return
    setSubmittingComplaint(true)
    try {
      const { error } = await supabase
        .from('ComplaintsTable')
        .insert({
          rollno: user.rollno,
          subject: complaintSubject.trim(),
          description: complaintDesc.trim() || null,
        })
      if (error) throw error

      playPop()
      setComplaintOpen(false)
      setComplaintSubject('')
      setComplaintDesc('')
      setToast('📬 Complaint filed successfully!')
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      console.error('Error submitting complaint:', err)
      alert('Failed to submit complaint')
    } finally {
      setSubmittingComplaint(false)
    }
  }

  // ── Unclaim ticket handler ──────────────────────────────────────
  const handleUnclaim = async (ticket) => {
    if (unclaiming) return
    if (!window.confirm("Release this ticket? It'll go back to pending.")) return
    setUnclaiming(true)
    try {
      const { error: claimsError } = await supabase
        .from('TicketClaims')
        .delete()
        .eq('ticketid', ticket.ticketid)
        .eq('claimant_rollno', user.rollno)
      if (claimsError) throw claimsError

      playClose()
      setSelectedTicket(null)
      await fetchUserTickets()

      // Push notification: notify ticket owner about unclaim
      notifyTicketUnclaimed(ticket, user.username, user.rollno)
    } catch (err) {
      console.error('Error unclaiming ticket:', err)
      alert('Failed to unclaim ticket')
    } finally {
      setUnclaiming(false)
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
            className={`db-nav-btn ${needsInstall ? 'db-nav-notif-install' : subscription ? 'db-nav-notif-enabled' : permissionStatus === 'denied' ? 'db-nav-notif-denied' : 'db-nav-notif-prompt'}`}
            onClick={handleToggleNotifications}
            disabled={notifLoading}
            id="nav-notifications"
          >
            {needsInstall ? <Smartphone size={16} /> : subscription ? <BellRing size={16} /> : permissionStatus === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
            <span>{notifLoading ? 'Loading…' : needsInstall ? 'Install App' : subscription ? 'Notifs On' : permissionStatus === 'denied' ? 'Blocked' : 'Enable Notifs'}</span>
          </button>
          <button
            className="db-nav-btn"
            onClick={() => { onClose(); if (onNavigateMarketplace) onNavigateMarketplace(); }}
            id="nav-marketplace"
          >
            <ShoppingBag size={16} />
            <span>Marketplace</span>
          </button>
          <button
            className="db-nav-btn db-nav-complaint"
            onClick={() => { playPop(); setComplaintOpen(true) }}
            id="nav-complaint"
          >
            <MessageSquareWarning size={16} />
            <span>Complaint</span>
          </button>
          <button
            className="db-nav-btn"
            onClick={() => { onClose(); navigate(`/profile/${user.rollno}`) }}
            id="nav-profile"
          >
            <UserCircle size={16} />
            <span>Profile</span>
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
                  onClick={(ticket) => {
                    playClaim();
                    if (activeTab === 'claimed' && ticket.status === 'closed' && ticket.ownerRollno !== user.rollno) {
                      setClosedAlertTicket(ticket);
                    } else {
                      setSelectedTicket(ticket);
                    }
                  }}
                  studentNames={studentNames}
                  user={user}
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
            className={`mp-detail-popup ${hasClaimed ? 'detail-claimed' : ''}`}
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
              {selectedTicket.price > 0 && (
                <div className="mp-detail-price">₹{selectedTicket.price}</div>
              )}
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
                Posted by <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag>
              </span>
            </div>

            {selectedTicket.claims?.length > 0 && (
              <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #bae6fd', marginTop: '16px' }}>
                <strong style={{ color: '#0284c7', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  👥 People who requested this offer ({selectedTicket.claims.length}):
                </strong>
                {(isOwner || selectedTicket.claims.length <= 5) ? (
                  <div style={{ marginTop: '10px' }}>
                    {isOwner && selectedTicket.claims.length > 5 && (
                      <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Scroll to view all claimants
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                      {selectedTicket.claims.map((c, i) => {
                        const uname = c.UserTable?.username || c.user?.username || c.claimant_rollno
                        return (
                          <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.7)', borderRadius: '6px', fontSize: '13px', color: '#0369a1', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}>
                            <span>
                              <NameTag username={uname} realName={studentNames?.[c.claimant_rollno]} className="mp-detail-nametag" style={{ color: '#0369a1' }}>
                                @{uname}
                              </NameTag>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#0369a1', fontStyle: 'italic' }}>
                    List hidden (too many claimants to show).
                  </div>
                )}
              </div>
            )}

            {/* ── Claimed state ── */}
            {hasClaimed && !isClosed && (
              <div className="mp-detail-claimed-banner">
                <CheckCircle2 size={20} className="mp-detail-claimed-icon" />
                <div className="mp-detail-claimed-text">
                  <strong>You have claimed this ticket!</strong>
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

            <div className="mp-detail-actions">
              {isOwner && !selectedTicket.claims?.length && !isClosed && (
                <div className="mp-detail-owner-note">
                  <AlertTriangle size={16} />
                  <span>This is your ticket — waiting for someone to claim it.</span>
                </div>
              )}
              {hasClaimed && !isOwner && !isClosed && (
                <div className="mp-detail-owner-note success">
                  <CheckCircle2 size={16} />
                  <span>
                    Reach out to <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to finalize.
                  </span>
                </div>
              )}

              {/* Unclaim button — only for the claimant */}
              {hasClaimed && !isOwner && !isClosed && (
                <button
                  className="db-unclaim-btn"
                  onClick={() => handleUnclaim(selectedTicket)}
                  disabled={unclaiming}
                  id="dash-unclaim-ticket-btn"
                >
                  {unclaiming ? (
                    <>
                      <div className="mp-detail-btn-spinner" />
                      Releasing…
                    </>
                  ) : (
                    <>
                      <Undo2 size={18} />
                      Unclaim Ticket
                    </>
                  )}
                </button>
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

      {/* ── Complaint Modal ── */}
      {complaintOpen && (
        <div
          className="db-complaint-overlay"
          onClick={() => setComplaintOpen(false)}
          id="complaint-modal-overlay"
        >
          <div
            className="db-complaint-modal"
            onClick={(e) => e.stopPropagation()}
            id="complaint-modal"
          >
            <button
              className="db-close-btn db-complaint-close"
              onClick={() => setComplaintOpen(false)}
              id="complaint-modal-close"
            >
              <X size={16} />
            </button>

            <div className="db-complaint-header">
              <MessageSquareWarning size={22} className="db-complaint-header-icon" />
              <h3>File a Complaint</h3>
            </div>
            <p className="db-complaint-subtitle">
              Something bugging you? Let the admins know.
            </p>

            <div className="db-complaint-form">
              <div className="db-complaint-field">
                <label htmlFor="complaint-subject">Subject</label>
                <input
                  id="complaint-subject"
                  type="text"
                  placeholder="What's the issue about?"
                  value={complaintSubject}
                  onChange={(e) => setComplaintSubject(e.target.value)}
                  className="db-complaint-input"
                  maxLength={255}
                />
              </div>
              <div className="db-complaint-field">
                <label htmlFor="complaint-desc">Description (optional)</label>
                <textarea
                  id="complaint-desc"
                  placeholder="Give us the full story…"
                  value={complaintDesc}
                  onChange={(e) => setComplaintDesc(e.target.value)}
                  className="db-complaint-textarea"
                  rows={4}
                />
              </div>
              <button
                className="db-complaint-submit"
                onClick={handleSubmitComplaint}
                disabled={submittingComplaint || !complaintSubject.trim()}
                id="complaint-submit-btn"
              >
                {submittingComplaint ? (
                  <>
                    <div className="mp-detail-btn-spinner" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Complaint
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS Install Guide Modal ── */}
      {showInstallGuide && (
        <div
          className="mp-modal-overlay"
          onClick={() => setShowInstallGuide(false)}
          id="ios-install-guide-overlay"
          style={{ zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="db-ios-install-guide"
            onClick={e => e.stopPropagation()}
            id="ios-install-guide"
          >
            <button
              className="db-close-btn"
              onClick={() => setShowInstallGuide(false)}
              style={{ position: 'absolute', top: '12px', right: '12px' }}
            >
              <X size={16} />
            </button>

            <div className="db-ios-install-header">
              <Smartphone size={32} className="db-ios-install-icon" />
              <h3>Install Jugaad Junction</h3>
              <p>
                To get push notifications on {isIos ? 'your iPhone/iPad' : 'this device'},
                you need to add Jugaad Junction to your Home Screen first.
              </p>
            </div>

            <div className="db-ios-install-steps">
              <div className="db-ios-step">
                <div className="db-ios-step-num">1</div>
                <div className="db-ios-step-content">
                  <strong>Tap the Share button</strong>
                  <span>The square with an arrow at the bottom of Safari</span>
                  <div className="db-ios-step-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                      <polyline points="16 6 12 2 8 6"/>
                      <line x1="12" y1="2" x2="12" y2="15"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="db-ios-step">
                <div className="db-ios-step-num">2</div>
                <div className="db-ios-step-content">
                  <strong>Tap "Add to Home Screen"</strong>
                  <span>Scroll down in the share sheet if you don't see it</span>
                  <div className="db-ios-step-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="12" y1="8" x2="12" y2="16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="db-ios-step">
                <div className="db-ios-step-num">3</div>
                <div className="db-ios-step-content">
                  <strong>Open from Home Screen</strong>
                  <span>Then tap "Enable Notifs" in the Dashboard</span>
                  <div className="db-ios-step-icon">
                    <Bell size={22} />
                  </div>
                </div>
              </div>
            </div>

            <button
              className="db-ios-install-dismiss"
              onClick={() => setShowInstallGuide(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* ── Witty Toast ── */}
      {toast && (
        <div className="db-toast" id="db-witty-toast">
          <span className="db-toast-msg">{toast}</span>
        </div>
      )}

      {/* ── Closed Ticket Alert Modal ── */}
      {closedAlertTicket && (
        <div
          className="mp-modal-overlay"
          onClick={() => setClosedAlertTicket(null)}
          style={{ zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            style={{
              background: '#fff',
              padding: '28px',
              borderRadius: '20px',
              maxWidth: '340px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
            <h3 style={{ color: '#0f172a', margin: '0 0 12px 0', fontSize: '22px' }}>Ticket Closed</h3>
            <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 28px 0' }}>
              The owner{' '}
              <NameTag username={closedAlertTicket.user} realName={studentNames?.[closedAlertTicket.ownerRollno]}>
                <strong>@{closedAlertTicket.user}</strong>
              </NameTag>{' '}
              has officially closed this ticket. It is no longer available.
            </p>
            <button
              onClick={() => setClosedAlertTicket(null)}
              style={{
                width: '100%',
                padding: '14px',
                background: '#0ea5e9',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '15px'
              }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
