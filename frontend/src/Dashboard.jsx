import { useState, useEffect, useMemo, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { usePushNotifications } from './usePushNotifications'
import { notifyTicketClosed, notifyClaimantApproved, notifyPaymentReceived, notifyTicketDeleted } from './pushNotificationHelper'
import {
  X,
  Lock,
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
  XCircle,
  Send,
  UserCircle,
  Smartphone,
  Wallet,
  Pencil,
  Check,
  CheckCheck,
  BadgeCheck,
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

// ── Credit score color helper ──────────────────────────────────
function getCreditTier(score) {
  if (score == null) return { className: 'credit-unknown', label: '?' }
  if (score >= 80) return { className: 'credit-excellent', label: '★' }
  if (score >= 60) return { className: 'credit-good', label: '●' }
  if (score >= 40) return { className: 'credit-fair', label: '◆' }
  if (score >= 20) return { className: 'credit-low', label: '▼' }
  return { className: 'credit-poor', label: '▾' }
}

function CreditBadge({ score, size = 'sm' }) {
  const tier = getCreditTier(score)
  return (
    <span className={`credit-badge ${tier.className} credit-${size}`} title={`Credit Score: ${score ?? 'N/A'}`}>
      <span className="credit-badge-icon">{tier.label}</span>
      <span className="credit-badge-value">{score ?? '–'}</span>
    </span>
  )
}

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
  const userClaim = user && ticket.claims?.find(c => c.claimant_rollno === user.rollno)
  const userClaimStatus = userClaim?.ticket_status
  // Check if the owner of a request ticket has paid a claimant
  const isOwnerOfRequest = user && ticket.ownerRollno === user.rollno && ticket.type === 'request'
  const ownerHasPaid = isOwnerOfRequest && ticket.claims?.some(c => c.ticket_status === 'paid') && ticket.status !== 'closed'
  // Only show approved/paid status to the claimant whose claim has that status
  const displayStatus = ownerHasPaid
    ? "you've paid"
    : (hasClaimed && ticket.status !== 'closed')
      ? (userClaimStatus === 'paid' ? 'paid' : userClaimStatus === 'approved' ? 'approved' : 'claimed')
      : ticket.status
  const displayStatusClass = ownerHasPaid ? 'youve-paid' : displayStatus
  // Dim for the user whose own claim is approved/paid, or for the owner who has paid
  const shouldDim = ownerHasPaid || (hasClaimed && (userClaimStatus === 'approved' || userClaimStatus === 'paid') && ticket.status !== 'closed')
  const approvedCount = ticket.claims?.filter(c => c.ticket_status === 'approved' || c.ticket_status === 'paid').length || 0

  return (
    <div
      className={`mp-ticket ${pick(CARD_VARIANTS, index)} mp-ticket-clickable${shouldDim ? ' mp-ticket-approved-dim' : ''}`}
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

      {ticket.claims?.length > 0 && (
        <div style={{ margin: '14px 0 10px 0' }}>
          {ticket.claims.length >= 3 ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#b91c1c', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              🔥 High Demand: {ticket.claims.length} claims!
            </div>
          ) : (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              📦 {ticket.claims.length} claim{ticket.claims.length > 1 ? 's' : ''}
            </div>
          )}
          {approvedCount > 0 && (
            <div className="mp-ticket-approved-count">
              ✅ {approvedCount} approved
            </div>
          )}
        </div>
      )}

      <div className="mp-ticket-footer">
        <span className="mp-ticket-user">
          <span className="mp-ticket-user-dot" />
          <NameTag username={ticket.user} realName={studentNames?.[ticket.ownerRollno] || 'Unknown'} />
          <CreditBadge score={ticket.ownerCredit} size="md" />
        </span>
        <span className={`mp-status ${displayStatusClass}`}>{displayStatus}</span>
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

  // UPI ID state
  const [upiId, setUpiId] = useState('')
  const [editingUpi, setEditingUpi] = useState(false)
  const [upiDraft, setUpiDraft] = useState('')
  const [upiSaving, setUpiSaving] = useState(false)
  const [upiError, setUpiError] = useState('')

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
    fetchUpiId()
    const channel = supabase.channel('dashboard_actions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'TicketTable' }, () => {
        fetchUserTickets()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'TicketClaims' }, () => {
        fetchUserTickets()
      })
      .on('broadcast', { event: 'ticket_action' }, () => {
        fetchUserTickets()
      })
      .subscribe()

    channelRef.current = channel

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
          owner:UserTable!TicketTable_owner_rollno_fkey ( username, social_credit ),
          claimant:UserTable!TicketTable_claimant_rollno_fkey ( username ),
          claims:TicketClaims ( claimant_rollno, ticket_status, UserTable ( username, social_credit ) ),
          title, description, category, status, "ItemPrice"
        `)
        .eq('owner_rollno', user.rollno)

      if (ownedError) throw ownedError

      if (ownedData) {
        const formattedOwned = ownedData.map(formatter)
        formattedOwned.sort((a, b) => {
          const aCredit = a.ownerCredit ?? 0
          const bCredit = b.ownerCredit ?? 0
          if (aCredit !== bCredit) {
            return bCredit - aCredit
          }
          const aClaims = a.claims?.length ?? 0
          const bClaims = b.claims?.length ?? 0
          return bClaims - aClaims
        })
        setTickets(formattedOwned)
      }

      // Fetch tickets user claimed
      const { data: claimsData, error: claimsError } = await supabase
        .from('TicketClaims')
        .select(`
          ticket:TicketTable!inner (
            ticketid, type, owner_rollno, claimant_rollno,
            owner:UserTable!TicketTable_owner_rollno_fkey ( username, social_credit ),
            claimant:UserTable!TicketTable_claimant_rollno_fkey ( username ),
            claims:TicketClaims ( claimant_rollno, ticket_status, UserTable ( username, social_credit ) ),
            title, description, category, status, "ItemPrice"
          )
        `)
        .eq('claimant_rollno', user.rollno)

      if (claimsError) throw claimsError

      if (claimsData) {
        const unwrappedClaims = claimsData.map(c => Array.isArray(c.ticket) ? c.ticket[0] : c.ticket).filter(Boolean)
        const formattedClaimed = unwrappedClaims.map(formatter)
        formattedClaimed.sort((a, b) => {
          const aCredit = a.ownerCredit ?? 0
          const bCredit = b.ownerCredit ?? 0
          if (aCredit !== bCredit) {
            return bCredit - aCredit
          }
          const aClaims = a.claims?.length ?? 0
          const bClaims = b.claims?.length ?? 0
          return bClaims - aClaims
        })
        setClaimedTickets(formattedClaimed)
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
    const ownerCredit = ownerObj?.social_credit ?? null
    // Sort claims by credit score descending
    const sortedClaims = [...(t.claims || [])].sort((a, b) => {
      const aScore = a.UserTable?.social_credit ?? 0
      const bScore = b.UserTable?.social_credit ?? 0
      return bScore - aScore
    })

    return {
      id: String(t.type === 'request' ? 'REQ-' : 'SEL-') + t.ticketid,
      ticketid: t.ticketid,
      title: t.title || 'Untitled',
      desc: t.description || '',
      category: t.category || 'General',
      price: t.ItemPrice || 0,
      user: username,
      ownerRollno: t.owner_rollno,
      ownerCredit,
      claimantRollno: t.claimant_rollno,
      status: t.status || 'pending',
      type: t.type || 'request',
      claims: sortedClaims
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
      // Capture claimant rollnos BEFORE deletion for notification
      const claimantRollnos = (ticket.claims || []).map(c => c.claimant_rollno).filter(Boolean)

      const { error: ticketError } = await supabase
        .from('TicketTable')
        .delete()
        .eq('ticketid', ticket.ticketid)
      if (ticketError) throw ticketError

      setSelectedTicket(null)
      await fetchUserTickets()

      // Push notification: notify all claimants that ticket was deleted
      notifyTicketDeleted(ticket, user.username, claimantRollnos)
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

  // ── Fetch UPI ID ────────────────────────────────────────────
  const fetchUpiId = async () => {
    try {
      const { data, error } = await supabase
        .from('UserTable')
        .select('upi_id')
        .eq('rollno', user.rollno)
        .single()
      if (!error && data) {
        setUpiId(data.upi_id || '')
      }
    } catch (err) {
      console.error('Error fetching UPI ID:', err)
    }
  }

  // ── Save UPI ID handler ─────────────────────────────────────
  const handleSaveUpi = async () => {
    const trimmed = upiDraft.trim()
    setUpiError('')

    if (trimmed && !/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/.test(trimmed)) {
      setUpiError('Invalid format. Use: username@bankname')
      return
    }
    if (trimmed.length > 50) {
      setUpiError('UPI ID is too long (max 50 chars).')
      return
    }

    setUpiSaving(true)
    try {
      const { error } = await supabase
        .from('UserTable')
        .update({ upi_id: trimmed || null })
        .eq('rollno', user.rollno)

      if (error) throw error

      setUpiId(trimmed)
      setEditingUpi(false)
      playPop()
      setToast('💳 UPI ID saved successfully!')
      setTimeout(() => setToast(null), 3200)
    } catch (err) {
      console.error('Error saving UPI ID:', err)
      setUpiError('Failed to save. Please try again.')
    } finally {
      setUpiSaving(false)
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

  // ── channelRef for broadcasting ───────────────────────────────
  const channelRef = useRef(null)

  // ── Approve claimant handler ──────────────────────────────────
  const [approving, setApproving] = useState(null)

  const handleApprove = async (ticket, claimantRollno) => {
    if (approving) return
    setApproving(claimantRollno)
    try {
      const { error } = await supabase
        .from('TicketClaims')
        .update({ ticket_status: 'approved' })
        .eq('ticketid', ticket.ticketid)
        .eq('claimant_rollno', claimantRollno)

      if (error) throw error

      playPop()
      await fetchUserTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })

      // Push notification: notify approved claimant
      notifyClaimantApproved(ticket, claimantRollno, user.username)

      // Update locally
      setSelectedTicket(prev => prev ? {
        ...prev,
        claims: (prev.claims || []).map(c =>
          c.claimant_rollno === claimantRollno ? { ...c, ticket_status: 'approved' } : c
        )
      } : null)

      // For request tickets: owner approved a helper, show payment popup immediately
      if (ticket.type === 'request' && ticket.ownerRollno === user.rollno) {
        const claimObj = ticket.claims?.find(c => c.claimant_rollno === claimantRollno)
        const claimantUsername = claimObj?.UserTable?.username || claimantRollno
        setSelectedTicket(null)
        openPaymentPopup(ticket, claimantRollno, claimantUsername)
      }
    } catch (err) {
      console.error('Error approving claimant:', err)
      alert('Failed to approve claimant')
    } finally {
      setApproving(null)
    }
  }

  // ── Close ticket state and handlers ────────────────────────────
  const [closing, setClosing] = useState(false)
  const [closeConfirmData, setCloseConfirmData] = useState(null)
  const [closeComplaintDesc, setCloseComplaintDesc] = useState('')

  const handleCloseWithConfirm = async (withComplaint) => {
    if (closing) return
    setClosing(true)
    try {
      const { error } = await supabase
        .from('TicketTable')
        .update({ status: 'closed' })
        .eq('ticketid', closeConfirmData.ticket.ticketid)
      if (error) throw error

      if (withComplaint && closeComplaintDesc.trim()) {
        // For request tickets: if the helper (claimant) is closing, complaint should be about the requestor (owner)
        const isRequestTicket = closeConfirmData.ticket.type === 'request'
        const isCloserTheClaimant = closeConfirmData.claimantRollno === user.rollno
        const complaintAbout = (isRequestTicket && isCloserTheClaimant)
          ? closeConfirmData.ticket.user
          : closeConfirmData.claimantName
        await supabase.from('ComplaintsTable').insert({
          rollno: user.rollno,
          subject: `Complaint about @${complaintAbout} on ticket ${closeConfirmData.ticket.id}`,
          description: closeComplaintDesc.trim(),
        })
      }

      await fetchUserTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })
      setSelectedTicket(prev => prev ? { ...prev, status: 'closed' } : null)
      const claimantRollnos = (closeConfirmData.ticket.claims || []).map(c => c.claimant_rollno).filter(Boolean)
      notifyTicketClosed(closeConfirmData.ticket, user.username, claimantRollnos)

      playClose()
      setCloseConfirmData(null)
      setCloseComplaintDesc('')
    } catch (err) {
      console.error('Error closing ticket:', err)
      alert('Failed to close ticket')
    } finally {
      setClosing(false)
    }
  }

  // ── Payment popup state for approved claims ───────────────────
  const [paymentPopupTicket, setPaymentPopupTicket] = useState(null)
  const [paymentPopupUpi, setPaymentPopupUpi] = useState('')
  const [paymentPopupPayee, setPaymentPopupPayee] = useState(null) // { rollno, username }
  const [paymentPopupPayeeName, setPaymentPopupPayeeName] = useState('')
  const [loadingUpi, setLoadingUpi] = useState(false)
  const [payStep, setPayStep] = useState(1)
  const [payAmount, setPayAmount] = useState('')
  const [markingPaid, setMarkingPaid] = useState(false)

  const PAID_MESSAGES = [
    "💸 Money gone. Friendship secured. Probably.",
    "🤝 Transaction complete! Your wallet is crying.",
    "🎉 Paid! You're officially broke but reliable.",
    "💰 Ka-ching! The jugaad economy thanks you.",
    "🫡 Payment confirmed! You are a person of honor.",
    "🪙 Coins sent into the void. Trust the process.",
    "💳 Your UPI app just shed a tear of joy.",
  ]

  const openPaymentPopup = async (ticket, payeeRollno, payeeUsername) => {
    setPaymentPopupTicket(ticket)
    setPaymentPopupPayee({ rollno: payeeRollno, username: payeeUsername })
    setPayStep(1)
    setPayAmount(ticket.price > 0 ? String(ticket.price) : '')
    setLoadingUpi(true)
    setPaymentPopupPayeeName('')
    try {
      const { data, error } = await supabase
        .from('UserTable')
        .select('upi_id')
        .eq('rollno', payeeRollno)
        .single()
      if (!error && data) {
        setPaymentPopupUpi(data.upi_id || '')
      }
      // Fetch real name for QR pn field
      const { data: nameData } = await supabase
        .from('StudentNames')
        .select('first_name')
        .eq('rollno', payeeRollno)
        .single()
      if (nameData) {
        setPaymentPopupPayeeName(nameData.first_name || payeeUsername)
      } else {
        setPaymentPopupPayeeName(payeeUsername)
      }
    } catch (err) {
      console.error('Error fetching payee UPI:', err)
      setPaymentPopupPayeeName(payeeUsername)
    } finally {
      setLoadingUpi(false)
    }
  }

  const handleMarkPaid = async () => {
    if (markingPaid || !paymentPopupTicket) return
    setMarkingPaid(true)
    try {
      // Update TicketClaims status to 'paid' (ticket stays open — owner closes it)
      const claimantRollno = paymentPopupTicket.ownerRollno === user.rollno
        ? paymentPopupPayee?.rollno
        : user.rollno
      const { error: claimError } = await supabase
        .from('TicketClaims')
        .update({ ticket_status: 'paid' })
        .eq('ticketid', paymentPopupTicket.ticketid)
        .eq('claimant_rollno', claimantRollno)
      if (claimError) throw claimError

      playPop()
      await fetchUserTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })

      // Push notification: notify the payment receiver
      const isOwnerPaying = paymentPopupTicket.ownerRollno === user.rollno
      const receiverRollno = isOwnerPaying ? paymentPopupPayee?.rollno : paymentPopupTicket.ownerRollno
      if (receiverRollno) {
        notifyPaymentReceived(paymentPopupTicket, user.username, receiverRollno)
      }

      setPaymentPopupTicket(null)
      setPaymentPopupPayee(null)
      setPayStep(1)
      setPayAmount('')

      const msg = PAID_MESSAGES[Math.floor(Math.random() * PAID_MESSAGES.length)]
      setToast(msg)
      setTimeout(() => setToast(null), 3500)
    } catch (err) {
      console.error('Error marking as paid:', err)
      alert('Failed to mark as paid')
    } finally {
      setMarkingPaid(false)
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

        {/* ── UPI ID Section ── */}
        <div className="db-upi-section" id="dashboard-upi-section">
          <div className="db-upi-header">
            <Wallet size={16} className="db-upi-icon" />
            <span className="db-upi-label">UPI ID</span>
          </div>
          {editingUpi ? (
            <div className="db-upi-edit" id="dashboard-upi-edit">
              <div className="db-upi-edit-row">
                <input
                  id="dashboard-upi-input"
                  className="db-upi-input"
                  type="text"
                  value={upiDraft}
                  onChange={(e) => { setUpiDraft(e.target.value); setUpiError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveUpi()}
                  placeholder="yourname@bankname"
                  autoFocus
                  maxLength={50}
                />
                <button
                  className="pf-edit-action-btn pf-save-btn"
                  onClick={handleSaveUpi}
                  disabled={upiSaving}
                  id="dashboard-upi-save"
                  title="Save"
                >
                  {upiSaving ? <div className="mp-detail-btn-spinner" /> : <Check size={16} />}
                </button>
                <button
                  className="pf-edit-action-btn pf-cancel-btn"
                  onClick={() => { setEditingUpi(false); setUpiDraft(''); setUpiError('') }}
                  id="dashboard-upi-cancel"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="db-upi-hint">Format: username@bankname (e.g. rahul@okaxis)</div>
              {upiError && <div className="db-upi-error">{upiError}</div>}
            </div>
          ) : (
            <div className="db-upi-display">
              <span className="db-upi-value" id="dashboard-upi-value">
                {upiId || <span className="db-upi-empty">Not set</span>}
              </span>
              <button
                className="pf-inline-edit-btn"
                onClick={() => { setUpiDraft(upiId); setEditingUpi(true); playPop() }}
                id="dashboard-upi-edit-btn"
                title="Edit UPI ID"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
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
                    // Claimed tab: check if user's claim on this ticket is approved (not paid)
                    if (activeTab === 'claimed') {
                      // For post/seller tickets: claimant pays owner (only if approved, not already paid)
                      if (ticket.type === 'post') {
                        const userClaim = ticket.claims?.find(c => c.claimant_rollno === user.rollno)
                        if (userClaim?.ticket_status === 'approved' && ticket.status !== 'closed') {
                          openPaymentPopup(ticket, ticket.ownerRollno, ticket.user)
                          return
                        }
                      }
                      // For request tickets: claimant whose claim is paid — show detail popup (they can close it)
                      // Do NOT open payment popup for paid request claimants
                      if (ticket.status === 'closed' && ticket.ownerRollno !== user.rollno) {
                        setClosedAlertTicket(ticket)
                        return
                      }
                    }
                    // Owner tab for request tickets: owner pays approved claimant (only if approved, not paid)
                    if ((activeTab === 'requested') && ticket.ownerRollno === user.rollno && ticket.status !== 'closed') {
                      const approvedClaim = ticket.claims?.find(c => c.ticket_status === 'approved')
                      if (approvedClaim) {
                        const claimantUsername = approvedClaim.UserTable?.username || approvedClaim.claimant_rollno
                        openPaymentPopup(ticket, approvedClaim.claimant_rollno, claimantUsername)
                        return
                      }
                    }
                    setSelectedTicket(ticket);
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
              <CreditBadge score={selectedTicket.ownerCredit} size="md" />
            </div>

            {selectedTicket.claims?.length > 0 && (
              <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #bae6fd', marginTop: '16px' }}>
                <strong style={{ color: '#0284c7', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  👥 People who claimed this ticket ({selectedTicket.claims.length}):
                </strong>
                {(isOwner || selectedTicket.claims.length <= 5) ? (
                  <div style={{ marginTop: '10px' }}>
                    {isOwner && selectedTicket.claims.length > 5 && (
                      <div style={{ fontSize: '11px', color: '#0369a1', marginBottom: '6px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Scroll to view all claimants
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px', paddingTop: '28px', marginTop: '-24px' }}>
                      {selectedTicket.claims.map((c, i) => {
                        const uname = c.UserTable?.username || c.user?.username || c.claimant_rollno
                        const claimCredit = c.UserTable?.social_credit ?? null
                        const isApproved = c.ticket_status === 'approved'
                        const isPaid = c.ticket_status === 'paid'
                        const isRequestTicket = selectedTicket.type === 'request'
                        // For request tickets: claimant can close when paid
                        const isThisClaimant = c.claimant_rollno === user.rollno
                        const canClaimantClose = isRequestTicket && isPaid && isThisClaimant && !isClosed
                        return (
                          <div key={i} style={{ padding: '8px 12px', background: (isApproved || isPaid) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.7)', borderRadius: '6px', fontSize: '13px', color: '#0369a1', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, border: (isApproved || isPaid) ? '1px solid rgba(16, 185, 129, 0.3)' : 'none' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <NameTag username={uname} realName={studentNames?.[c.claimant_rollno]} className="mp-detail-nametag" style={{ color: '#0369a1' }}>
                                @{uname}
                              </NameTag>
                              <CreditBadge score={claimCredit} size="xs" />
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isPaid && (
                                <span className="mp-paid-funky"><Wallet size={12} /> {isRequestTicket ? 'Requestor Paid' : 'Paid'}</span>
                              )}
                              {isApproved && (
                                <span className="mp-approved-funky"><BadgeCheck size={12} /> Approved</span>
                              )}
                              {/* Owner actions for post tickets: approve or close */}
                              {isOwner && !isClosed && !isRequestTicket && (
                                (isApproved || isPaid) ? (
                                  <button
                                    className="mp-close-for-claimant-btn"
                                    onClick={(e) => { e.stopPropagation(); setCloseConfirmData({ ticket: selectedTicket, claimantRollno: c.claimant_rollno, claimantName: uname }); setCloseComplaintDesc('') }}
                                  >
                                    <XCircle size={12} /> Close
                                  </button>
                                ) : (
                                  <button
                                    className="mp-approve-btn"
                                    onClick={(e) => { e.stopPropagation(); handleApprove(selectedTicket, c.claimant_rollno) }}
                                    disabled={approving === c.claimant_rollno}
                                    title="Approve this claimant"
                                  >
                                    {approving === c.claimant_rollno ? <div className="mp-detail-btn-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <CheckCheck size={13} />}
                                  </button>
                                )
                              )}
                              {/* Owner actions for request tickets: approve only (pre-approved) */}
                              {isOwner && !isClosed && isRequestTicket && !isApproved && !isPaid && (
                                <button
                                  className="mp-approve-btn"
                                  onClick={(e) => { e.stopPropagation(); handleApprove(selectedTicket, c.claimant_rollno) }}
                                  disabled={approving === c.claimant_rollno}
                                  title="Approve this claimant"
                                >
                                  {approving === c.claimant_rollno ? <div className="mp-detail-btn-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <CheckCheck size={13} />}
                                </button>
                              )}
                              {/* Claimant close button on request tickets when paid */}
                              {canClaimantClose && (
                                <button
                                  className="mp-close-for-claimant-btn"
                                  onClick={(e) => { e.stopPropagation(); setCloseConfirmData({ ticket: selectedTicket, claimantRollno: c.claimant_rollno, claimantName: uname }); setCloseComplaintDesc('') }}
                                >
                                  <XCircle size={12} /> Close
                                </button>
                              )}
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

            {/* ── Claimed / Approved state ── */}
            {hasClaimed && !isClosed && (() => {
              const userClaim = selectedTicket.claims?.find(c => c.claimant_rollno === user.rollno)
              const isPaidClaim = userClaim?.ticket_status === 'paid'
              const isApprovedClaim = userClaim?.ticket_status === 'approved'
              const isRequestTicket = selectedTicket.type === 'request'
              if (isPaidClaim) {
                // Request tickets: the OWNER paid the claimant
                if (isRequestTicket) return (
                  <div className="mp-detail-paid-banner">
                    <Wallet size={20} className="mp-detail-paid-icon" />
                    <div className="mp-detail-paid-text">
                      <strong>💰 The requestor has paid you!</strong>
                      <span><NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> has completed the payment. You can now close this ticket.</span>
                    </div>
                  </div>
                )
                // Post tickets: the CLAIMANT paid the owner
                return (
                  <div className="mp-detail-paid-banner">
                    <Wallet size={20} className="mp-detail-paid-icon" />
                    <div className="mp-detail-paid-text">
                      <strong>💰 You've marked this as paid!</strong>
                      <span>Waiting for <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to close the ticket.</span>
                    </div>
                  </div>
                )
              }
              if (isApprovedClaim) return (
                <div className="mp-detail-approved-banner">
                  <BadgeCheck size={20} className="mp-detail-approved-icon" />
                  <div className="mp-detail-approved-text">
                    <strong>🎉 Your claim has been approved!</strong>
                    <span>Reach out to <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to finalize.</span>
                  </div>
                </div>
              )
              return (
                <>
                  <div className="mp-detail-claimed-banner">
                    <CheckCircle2 size={20} className="mp-detail-claimed-icon" />
                    <div className="mp-detail-claimed-text">
                      <strong>You have claimed this ticket!</strong>
                    </div>
                  </div>
                  <div className="mp-detail-owner-note success">
                    <CheckCircle2 size={16} />
                    <span>
                      Reach out to <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to finalize.
                    </span>
                  </div>
                </>
              )
            })()}

            {/* ── Owner paid banner (request tickets) ── */}
            {isOwner && !isClosed && (() => {
              const isRequestTicket = selectedTicket.type === 'request'
              const paidClaim = selectedTicket.claims?.find(c => c.ticket_status === 'paid')
              if (isRequestTicket && paidClaim) {
                const helperName = paidClaim.UserTable?.username || paidClaim.claimant_rollno
                return (
                  <div className="mp-detail-paid-banner">
                    <Wallet size={20} className="mp-detail-paid-icon" />
                    <div className="mp-detail-paid-text">
                      <strong>💰 You've paid the helper!</strong>
                      <span>Payment to <NameTag username={helperName} realName={studentNames?.[paidClaim.claimant_rollno]} className="mp-detail-nametag"><strong>@{helperName}</strong></NameTag> confirmed. Waiting for them to close the ticket.</span>
                    </div>
                  </div>
                )
              }
              return null
            })()}

            {/* ── Closed state banner ── */}
            {isClosed && (() => {
              const isRequestTicket = selectedTicket.type === 'request'
              let closedMsg = 'The owner has closed this ticket.'
              if (isOwner) {
                closedMsg = isRequestTicket
                  ? 'The helper confirmed receipt and closed this ticket. 🎉'
                  : 'You marked this deal as done. 🎉'
              } else if (hasClaimed) {
                closedMsg = isRequestTicket
                  ? 'You confirmed receipt and closed this ticket. 🎉'
                  : 'The owner has closed this ticket.'
              }
              return (
                <div className="mp-detail-closed-banner" id="closed-banner">
                  <Lock size={20} className="mp-detail-closed-icon" />
                  <div className="mp-detail-closed-text">
                    <strong>This ticket is closed.</strong>
                    <span className="mp-detail-closed-sub">{closedMsg}</span>
                  </div>
                </div>
              )
            })()}

            <div className="mp-detail-actions">
              {isOwner && !selectedTicket.claims?.length && !isClosed && (
                <div className="mp-detail-owner-note">
                  <AlertTriangle size={16} />
                  <span>This is your ticket — waiting for someone to claim it.</span>
                </div>
              )}

              {/* Unclaim button — only for the claimant, hide when paid */}
              {hasClaimed && !isOwner && !isClosed && (() => {
                const userClaim = selectedTicket.claims?.find(c => c.claimant_rollno === user.rollno)
                const isPaidClaim = userClaim?.ticket_status === 'paid'
                if (isPaidClaim) return null
                return (
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
                )
              })()}

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

      {/* ── Payment Popup for Approved Claims (QR Code Flow) ── */}
      {paymentPopupTicket && (
        <div
          className="mp-modal-overlay"
          onClick={() => { setPaymentPopupTicket(null); setPaymentPopupPayee(null); setPayStep(1); setPayAmount('') }}
          id="payment-popup-overlay"
          style={{ zIndex: 500 }}
        >
          <div
            className="db-payment-popup"
            onClick={(e) => e.stopPropagation()}
            id="payment-popup-card"
          >
            <button
              className="db-close-btn db-payment-close"
              onClick={() => { setPaymentPopupTicket(null); setPaymentPopupPayee(null); setPayStep(1); setPayAmount('') }}
              id="payment-popup-close"
            >
              <X size={16} />
            </button>

            <div className="db-payment-icon">
              <BadgeCheck size={32} />
            </div>

            <h3 className="db-payment-title">
              {paymentPopupTicket.type === 'request' && paymentPopupTicket.ownerRollno === user.rollno
                ? 'Helper Approved! 🎉'
                : 'Claim Approved! 🎉'}
            </h3>
            <p className="db-payment-subtitle">
              {paymentPopupTicket.type === 'request' && paymentPopupTicket.ownerRollno === user.rollno ? (
                <>You approved <NameTag username={paymentPopupPayee?.username} realName={studentNames?.[paymentPopupPayee?.rollno]}><strong>@{paymentPopupPayee?.username}</strong></NameTag> to help with <strong>"{paymentPopupTicket.title}"</strong>. Pay them to finalize.</>
              ) : (
                <>Your claim on <strong>"{paymentPopupTicket.title}"</strong> has been approved by{' '}
                <NameTag username={paymentPopupTicket.user} realName={studentNames?.[paymentPopupTicket.ownerRollno]}>
                  <strong>@{paymentPopupTicket.user}</strong>
                </NameTag>.</>
              )}
            </p>

            {/* ── Step indicator ── */}
            <div className="db-pay-steps">
              <div className={`db-pay-step-dot ${payStep >= 1 ? 'active' : ''}`}>1</div>
              <div className="db-pay-step-line" />
              <div className={`db-pay-step-dot ${payStep >= 2 ? 'active' : ''}`}>2</div>
            </div>

            {loadingUpi ? (
              <div className="db-payment-loading-state">
                <div className="mp-detail-btn-spinner" style={{ width: 24, height: 24, borderWidth: 2.5 }} />
                <span>Loading payment info…</span>
              </div>
            ) : payStep === 1 ? (
              /* ── STEP 1: Enter Amount ── */
              <div className="db-pay-step-content">
                <label className="db-pay-amount-label" htmlFor="pay-amount-input">Negotiated Amount (₹)</label>
                <input
                  id="pay-amount-input"
                  className="db-pay-amount-input"
                  type="number"
                  min="1"
                  placeholder="Enter amount…"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && payAmount && Number(payAmount) > 0 && paymentPopupUpi && setPayStep(2)}
                  autoFocus
                />
                {!paymentPopupUpi && (
                  <div className="db-pay-no-upi-warning">
                    ⚠️ {paymentPopupTicket.type === 'request' && paymentPopupTicket.ownerRollno === user.rollno
                      ? "Helper hasn't added their UPI ID yet"
                      : "Seller hasn't added their UPI ID yet"}
                  </div>
                )}
                <button
                  className={`db-pay-confirm-btn ${!paymentPopupUpi ? 'disabled' : ''}`}
                  onClick={() => setPayStep(2)}
                  disabled={!payAmount || Number(payAmount) <= 0 || !paymentPopupUpi}
                  title={!paymentPopupUpi ? "Seller hasn't added their UPI ID yet" : ''}
                  id="pay-confirm-amount-btn"
                >
                  <Wallet size={16} />
                  {!paymentPopupUpi ? "Can't Pay — No UPI ID" : 'Pay Now'}
                </button>
              </div>
            ) : (
              /* ── STEP 2: QR Code ── */
              <div className="db-pay-step-content">
                <div className="db-pay-qr-amount-display">
                  <span className="db-pay-qr-amount-label">Amount</span>
                  <span className="db-pay-qr-amount-value">₹{payAmount}</span>
                </div>

                <div className="db-pay-qr-container">
                  <QRCodeSVG
                    value={`upi://pay?pa=${encodeURIComponent(paymentPopupUpi)}&pn=${encodeURIComponent(paymentPopupPayeeName)}&am=${encodeURIComponent(payAmount)}&cu=INR&tn=${encodeURIComponent('Jugaad:' + paymentPopupTicket.title)}`}
                    size={180}
                    bgColor="#2c1810"
                    fgColor="#f5e6d3"
                    level="M"
                    includeMargin={true}
                  />
                </div>

                <div className="db-pay-qr-hint">Scan with any UPI app to pay</div>

                <div className="db-pay-qr-upi-row">
                  <Wallet size={14} />
                  <span>{paymentPopupUpi}</span>
                </div>

                <div className="db-pay-action-row">
                  <button
                    className="db-pay-back-btn"
                    onClick={() => setPayStep(1)}
                  >
                    ← Back
                  </button>
                  <button
                    className="db-pay-paid-btn"
                    onClick={handleMarkPaid}
                    disabled={markingPaid}
                    id="mark-paid-btn"
                  >
                    {markingPaid ? (
                      <><div className="mp-detail-btn-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Confirming…</>
                    ) : (
                      <><CheckCheck size={16} /> I've Paid</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Close Confirmation Popup (High Contrast) ── */}
      {closeConfirmData && (
        <div
          className="mp-modal-overlay"
          onClick={() => { setCloseConfirmData(null); setCloseComplaintDesc('') }}
          id="dash-close-confirm-overlay"
          style={{ zIndex: 500 }}
        >
          <div
            className="mp-close-confirm-card"
            onClick={(e) => e.stopPropagation()}
            id="dash-close-confirm-card"
          >
            <button
              className="mp-close-confirm-x"
              onClick={() => { setCloseConfirmData(null); setCloseComplaintDesc('') }}
            >
              <X size={14} />
            </button>

            <div className="mp-close-confirm-emoji">🔒</div>
            <h3 className="mp-close-confirm-title">Close Ticket?</h3>
            <p className="mp-close-confirm-desc">
              Closing <strong>{closeConfirmData.ticket.id}</strong> for <strong>@{closeConfirmData.claimantName}</strong>.
            </p>

            <div className="mp-close-confirm-complaint-section">
              <p className="mp-close-confirm-complaint-label">⚠️ Raise a complaint about @{(closeConfirmData.ticket.type === 'request' && closeConfirmData.claimantRollno === user.rollno) ? closeConfirmData.ticket.user : closeConfirmData.claimantName}?</p>
              <textarea
                className="mp-close-confirm-textarea"
                placeholder="Describe any issue (optional)…"
                value={closeComplaintDesc}
                onChange={(e) => setCloseComplaintDesc(e.target.value)}
                rows={3}
              />
            </div>

            <div className="mp-close-confirm-actions">
              <button
                className="mp-close-confirm-btn close-only"
                onClick={() => handleCloseWithConfirm(false)}
                disabled={closing}
              >
                {closing ? <><div className="mp-detail-btn-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Closing…</> : <><Lock size={14} /> Just Close</>}
              </button>
              {closeComplaintDesc.trim() && (
                <button
                  className="mp-close-confirm-btn close-complain"
                  onClick={() => handleCloseWithConfirm(true)}
                  disabled={closing}
                >
                  {closing ? <><div className="mp-detail-btn-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Filing…</> : <><AlertTriangle size={14} /> Close & Complain</>}
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
