import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
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
  Undo2,
  Shield,
  HelpCircle,
  Zap,
  Star,
  ThumbsUp,
  Ticket,
  CircleDollarSign,
  UserCircle,
  Wallet,
  Check,
  CheckCheck,
  BadgeCheck,
} from 'lucide-react'
import Dashboard from './Dashboard'
import { usePushNotifications } from './usePushNotifications'
import { notifyTicketClaimed, notifyTicketUnclaimed, notifyNewTicketPosted, notifyTicketClosed, notifyClaimantApproved, notifyPaymentReceived, notifyTicketDeleted } from './pushNotificationHelper'
import { playClick, playPop, playWhoosh, playSuccess, playError, playClaim, playClose } from './sounds'
import './Marketplace.css'

import NameTag from './NameTag'
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
const PIN_COLORS = ['pin-red', 'pin-yellow', 'pin-green', 'pin-blue', 'pin-orange']

function pick(arr, i) {
  return arr[i % arr.length]
}

// ─── Credit score color helper ─────────────────────────────────
function getCreditTier(score) {
  if (score == null) return { className: 'credit-unknown', label: '?' }
  if (score >= 80) return { className: 'credit-excellent', label: '★' }
  if (score >= 60) return { className: 'credit-good', label: '●' }
  if (score >= 40) return { className: 'credit-fair', label: '◆' }
  if (score >= 20) return { className: 'credit-low', label: '▼' }
  return { className: 'credit-poor', label: '▾' }
}

function CreditBadge({ score, size = 'lg' }) {
  const tier = getCreditTier(score)
  return (
    <span className={`credit-badge ${tier.className} credit-${size}`} title={`Credit Score: ${score ?? 'N/A'}`}>
      <span className="credit-badge-icon">{tier.label}</span>
      <span className="credit-badge-value">{score ?? '–'}</span>
    </span>
  )
}

// ─── TicketCard ─────────────────────────────────────────────────
function TicketCard({ ticket, index, type, onClick, studentNames, user }) {
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
          <NameTag username={ticket.user} realName={studentNames?.[ticket.ownerRollno]} />
          <CreditBadge score={ticket.ownerCredit} size="md" />
        </span>
        <span className={`mp-status ${displayStatusClass}`}>{displayStatus}</span>
      </div>
    </div>
  )
}

// ─── Marketplace ────────────────────────────────────────────────
export default function Marketplace({ user, onLogout, onToggleAdminView }) {
  const navigate = useNavigate()
  // Setup push notifications based on user
  usePushNotifications(user?.rollno)

  // filter / search state
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  // dashboard state
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // check if just signed up
  useEffect(() => {
    if (localStorage.getItem('jj_just_signed_up') === 'true') {
      setHelpOpen(true)
      localStorage.removeItem('jj_just_signed_up')
    }
  }, [])

  // modal state (create ticket)
  const [modalOpen, setModalOpen] = useState(null) // 'request' | 'seller' | null
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formPrice, setFormPrice] = useState('')

  // ticket detail popup state
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [claiming, setClaiming] = useState(false)

  // ticket state
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [studentNames, setStudentNames] = useState({})

  // persist channel for broadcasting
  const channelRef = useRef(null)

  // UPI prompt state for seller posts
  const [upiPromptOpen, setUpiPromptOpen] = useState(false)
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
  }, [])

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('TicketTable')
        .select(`
          ticketid,
          type,
          owner_rollno,
          claimant_rollno,
          owner:UserTable!TicketTable_owner_rollno_fkey ( username, social_credit ),
          claimant:UserTable!TicketTable_claimant_rollno_fkey ( username ),
          claims:TicketClaims ( claimant_rollno, ticket_status, UserTable ( username, social_credit ) ),
          title, description, category, status, "ItemPrice"
        `)

      if (error) throw error

      if (data) {
        const formattedTickets = data.map(t => {
          const ownerObj = Array.isArray(t.owner) ? t.owner[0] : t.owner
          const username = ownerObj ? ownerObj.username : 'unknown'
          const ownerCredit = ownerObj?.social_credit ?? null
          const claimantObj = Array.isArray(t.claimant) ? t.claimant[0] : t.claimant
          const claimantUsername = claimantObj ? claimantObj.username : null
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
            claimantUser: claimantUsername,
            status: t.status || 'pending',
            type: t.type || 'request',
            claims: sortedClaims
          }
        })
        // Sort tickets: ascending order of owner credit score, then ascending by number of claims
        formattedTickets.sort((a, b) => {
          const aCredit = a.ownerCredit ?? 0
          const bCredit = b.ownerCredit ?? 0
          if (aCredit !== bCredit) {
            return bCredit - aCredit
          }
          const aClaims = a.claims?.length ?? 0
          const bClaims = b.claims?.length ?? 0
          return bClaims - aClaims
        })
        setTickets(formattedTickets)
      }
    } catch (err) {
      console.error('Error fetching tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()

    // Realtime subscriptions for dynamic updates
    const channel = supabase.channel('marketplace-tickets', {
      config: {
        broadcast: { self: false }
      }
    })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'TicketTable' }, () => {
        fetchTickets()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'TicketClaims' }, () => {
        fetchTickets()
      })
      .on('broadcast', { event: 'ticket_action' }, () => {
        fetchTickets()
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Update selected ticket details dynamically when the 'tickets' array is refreshed from realtime updates
  useEffect(() => {
    setSelectedTicket(prev => {
      if (!prev) return null
      const updated = tickets.find(t => t.id === prev.id)
      if (updated) {
        if (
          updated.status !== prev.status ||
          updated.claimantRollno !== prev.claimantRollno ||
          updated.price !== prev.price ||
          updated.title !== prev.title ||
          updated.desc !== prev.desc
        ) {
          return updated
        }
        return prev
      }
      return null // the ticket might have been deleted
    })
  }, [tickets])

  const closeModal = () => {
    setModalOpen(null)
    setFormTitle('')
    setFormDesc('')
    setFormCategory('')
    setFormPrice('')
  }

  const handleSubmit = async () => {
    if (!formTitle || !formCategory) {
      alert("Please fill in title and category")
      return
    }

    try {
      const dbType = modalOpen === 'seller' ? 'post' : 'request'

      const { error: ticketError } = await supabase
        .from('TicketTable')
        .insert({
          owner_rollno: user.rollno,
          type: dbType,
          title: formTitle,
          description: formDesc,
          category: formCategory,
          "ItemPrice": formPrice ? parseInt(formPrice, 10) : 0,
          status: 'pending'
        })

      if (ticketError) throw ticketError

      closeModal()
      playSuccess()
      await fetchTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })

      // Push notification: new ticket posted (global broadcast)
      notifyNewTicketPosted(formTitle, dbType, user.username, user.rollno)
    } catch (err) {
      playError()
      console.error("Error creating ticket:", err)
      alert("Failed to create ticket")
    }
  }

  // ── UPI ID check before seller post ─────────────────────────────
  const handlePostClick = async () => {
    playPop()
    try {
      const { data, error } = await supabase
        .from('UserTable')
        .select('upi_id')
        .eq('rollno', user.rollno)
        .single()

      if (error) throw error

      if (data?.upi_id) {
        // Has UPI — go straight to the post form
        setModalOpen('seller')
      } else {
        // No UPI — show prompt
        setUpiDraft('')
        setUpiError('')
        setUpiPromptOpen(true)
      }
    } catch (err) {
      console.error('Error checking UPI ID:', err)
      // Fallback: still let them post
      setModalOpen('seller')
    }
  }

  // ── Save UPI from prompt and proceed to seller post ─────────
  const handleUpiPromptSave = async () => {
    const trimmed = upiDraft.trim()
    setUpiError('')

    if (!trimmed) {
      setUpiError('Please enter your UPI ID.')
      return
    }
    if (!/^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/.test(trimmed)) {
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
        .update({ upi_id: trimmed })
        .eq('rollno', user.rollno)

      if (error) throw error

      playSuccess()
      setUpiPromptOpen(false)
      setModalOpen('seller')
    } catch (err) {
      console.error('Error saving UPI ID:', err)
      playError()
      setUpiError('Failed to save. Please try again.')
    } finally {
      setUpiSaving(false)
    }
  }

  // ─── Claim ticket handler ──────────────────────────────────────
  const handleClaim = async (ticket) => {
    if (claiming) return
    setClaiming(true)

    try {
      const { error: claimsError } = await supabase
        .from('TicketClaims')
        .insert({ ticketid: ticket.ticketid, claimant_rollno: user.rollno })

      if (claimsError && claimsError.code !== '23505') throw claimsError // ignore duplicates

      // Refresh ticket list and update the selected ticket in the popup
      playClaim()
      await fetchTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })

      // Push notification: notify ticket owner
      notifyTicketClaimed(ticket, user.username, user.rollno)

      // Update selected ticket locally so the popup reflects the change instantly
      setSelectedTicket(prev => prev ? {
        ...prev,
        claims: [...(prev.claims || []), { claimant_rollno: user.rollno, ticket_status: 'claimed', UserTable: { username: user.username } }]
      } : null)
    } catch (err) {
      console.error('Error claiming ticket:', err)
      alert('Failed to claim ticket')
    } finally {
      setClaiming(false)
    }
  }

  // ─── Approve claimant handler ──────────────────────────────────
  const [approving, setApproving] = useState(null) // holds claimant_rollno being approved

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

      playSuccess()
      await fetchTickets()
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
      // Capture claimant rollnos BEFORE deletion for notification
      const claimantRollnos = (ticket.claims || []).map(c => c.claimant_rollno).filter(Boolean)

      const { error: ticketError } = await supabase
        .from('TicketTable')
        .delete()
        .eq('ticketid', ticket.ticketid)
      if (ticketError) throw ticketError

      setSelectedTicket(null)
      playClose()
      await fetchTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })

      // Push notification: notify all claimants that ticket was deleted
      notifyTicketDeleted(ticket, user.username, claimantRollnos)
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
        .from('TicketTable')
        .update({ status: 'closed' })
        .eq('ticketid', ticket.ticketid)

      if (error) throw error

      await fetchTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })
      setSelectedTicket(prev => prev ? { ...prev, status: 'closed' } : null)

      // Push notification: notify all claimants that ticket is closed
      const claimantRollnos = (ticket.claims || []).map(c => c.claimant_rollno).filter(Boolean)
      notifyTicketClosed(ticket, user.username, claimantRollnos)
    } catch (err) {
      console.error('Error closing ticket:', err)
      alert('Failed to close ticket')
    } finally {
      setClosing(false)
    }
  }

  // ─── Unclaim ticket handler ──────────────────────────────────────
  const [unclaiming, setUnclaiming] = useState(false)

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
      await fetchTickets()
      channelRef.current?.send({ type: 'broadcast', event: 'ticket_action', payload: {} })

      // Push notification: notify ticket owner about unclaim
      notifyTicketUnclaimed(ticket, user.username, user.rollno)

      setSelectedTicket(prev => prev ? {
        ...prev,
        claims: (prev.claims || []).filter(c => c.claimant_rollno !== user.rollno)
      } : null)
    } catch (err) {
      console.error('Error unclaiming ticket:', err)
      alert('Failed to unclaim ticket')
    } finally {
      setUnclaiming(false)
    }
  }

  // ─── Payment popup for approved claims ────────────────────────────
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
  const [paidToast, setPaidToast] = useState(null)

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
      await fetchTickets()
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
      setPaidToast(msg)
      setTimeout(() => setPaidToast(null), 3500)
    } catch (err) {
      console.error('Error marking as paid:', err)
      alert('Failed to mark as paid')
    } finally {
      setMarkingPaid(false)
    }
  }

  // ─── Ticket click handler (detect approved claims) ────────────────
  const handleTicketClick = (ticket) => {
    playClaim()
    // For seller/post tickets: claimant sees payment popup to pay the owner (only if approved, not already paid)
    if (ticket.type === 'post') {
      const userClaim = ticket.claims?.find(c => c.claimant_rollno === user.rollno)
      if (userClaim?.ticket_status === 'approved' && ticket.status !== 'closed') {
        openPaymentPopup(ticket, ticket.ownerRollno, ticket.user)
        return
      }
    }
    // For request tickets: owner sees payment popup to pay the approved claimant (only if approved, not already paid)
    if (ticket.type === 'request' && ticket.ownerRollno === user.rollno && ticket.status !== 'closed') {
      const approvedClaim = ticket.claims?.find(c => c.ticket_status === 'approved')
      if (approvedClaim) {
        const claimantUsername = approvedClaim.UserTable?.username || approvedClaim.claimant_rollno
        openPaymentPopup(ticket, approvedClaim.claimant_rollno, claimantUsername)
        return
      }
    }
    // For request tickets: claimant whose claim is paid — show detail popup (they can close it)
    // Do NOT open payment popup for paid request claimants
    setSelectedTicket(ticket)
  }

  // ─── Close confirm popup state ────────────────────────────────────
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

      await fetchTickets()
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

  // Determine popup state for selected ticket
  const isOwner = selectedTicket?.ownerRollno === user.rollno
  const hasClaimed = selectedTicket?.claims?.some(c => c.claimant_rollno === user.rollno) || false
  const isClosed = selectedTicket?.status === 'closed'

  return (
    <div className="marketplace" id="marketplace-root">
      {/* ── Top bar ── */}
      <header className="mp-topbar" id="marketplace-topbar">
        <span className="mp-topbar-title">📌 Jugaad Junction</span>

        <div className="mp-topbar-user">
          <button
            className="mp-help-btn"
            onClick={() => setHelpOpen(true)}
            id="help-btn"
            title="Help"
          >
            <HelpCircle size={18} />
          </button>
          {onToggleAdminView && (
            <button className="mp-logout-btn" onClick={onToggleAdminView} style={{ marginRight: '10px', background: 'var(--red-pastel)', borderColor: 'var(--red-dark)' }}>
              <Shield size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Admin
            </button>
          )}
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
            onClick={() => { playClick(); setActiveFilter(cat) }}
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
                  onClick={handleTicketClick}
                  studentNames={studentNames}
                  user={user}
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
                  onClick={handleTicketClick}
                  studentNames={studentNames}
                  user={user}
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
          onClick={() => { playPop(); setModalOpen('request') }}
          id="fab-request"
        >
          <Hand size={20} />
          Request
        </button>
        <button
          className="mp-fab post"
          onClick={handlePostClick}
          id="fab-post"
        >
          <Plus size={20} />
          Post
        </button>
      </div>

      {/* ── UPI ID Prompt Modal ── */}
      {upiPromptOpen && (
        <div
          className="mp-modal-overlay"
          onClick={() => setUpiPromptOpen(false)}
          id="upi-prompt-overlay"
          style={{ zIndex: 350 }}
        >
          <div
            className="mp-upi-prompt"
            onClick={(e) => e.stopPropagation()}
            id="upi-prompt-card"
          >
            <button
              className="mp-modal-close mp-detail-close"
              onClick={() => setUpiPromptOpen(false)}
              id="upi-prompt-close"
              style={{ position: 'absolute', top: 12, right: 12 }}
            >
              <X size={16} />
            </button>

            <div className="mp-upi-prompt-icon">
              <Wallet size={28} />
            </div>
            <h3 className="mp-upi-prompt-title">Add Your UPI ID</h3>
            <p className="mp-upi-prompt-desc">
              Before posting an offer, add your UPI ID so buyers can pay you easily.
            </p>

            <div className="mp-upi-prompt-field">
              <input
                id="upi-prompt-input"
                className="mp-upi-prompt-input"
                type="text"
                value={upiDraft}
                onChange={(e) => { setUpiDraft(e.target.value); setUpiError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleUpiPromptSave()}
                placeholder="yourname@bankname"
                autoFocus
                maxLength={50}
              />
              <div className="mp-upi-prompt-hint">e.g. rahul@okaxis, priya@ybl</div>
              {upiError && <div className="mp-upi-prompt-error">{upiError}</div>}
            </div>

            <button
              className="mp-upi-prompt-save"
              onClick={handleUpiPromptSave}
              disabled={upiSaving}
              id="upi-prompt-save-btn"
            >
              {upiSaving ? (
                <><div className="mp-detail-btn-spinner" /> Saving…</>
              ) : (
                <><Check size={16} /> Save & Continue</>
              )}
            </button>
          </div>
        </div>
      )}

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
                <label className="mp-modal-label" htmlFor="modal-price-input">
                  Price (₹)
                </label>
                <input
                  id="modal-price-input"
                  className="mp-modal-input"
                  type="number"
                  placeholder="0 for free / exchange"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  min="0"
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
                className={`mp-modal-submit ${modalOpen === 'request' ? 'request-submit' : 'seller-submit'
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
            className={`mp-detail-popup ${hasClaimed ? 'detail-claimed' : ''} ${isClosed ? 'detail-closed' : ''}`}
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
              {selectedTicket.price > 0 && (
                <div className="mp-detail-price">₹{selectedTicket.price}</div>
              )}
            </div>

            {/* Description */}
            <p className="mp-detail-desc">{selectedTicket.desc || 'No description provided.'}</p>

            {/* Metadata row */}
            <div className="mp-detail-meta">
              <span className="mp-detail-category">{selectedTicket.category}</span>
              <span className={`mp-status ${selectedTicket.status}`}>{selectedTicket.status}</span>
            </div>

            <div className="mp-detail-divider" />

            {selectedTicket.claims && selectedTicket.claims.length > 0 && (
              <div style={{ background: (selectedTicket.claims.length >= 3) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: `1px solid ${(selectedTicket.claims.length >= 3) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}` }}>
                <strong style={{ color: (selectedTicket.claims.length >= 3) ? '#b91c1c' : '#059669', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                  {(selectedTicket.claims.length >= 3) ? '🔥 High Demand: ' : '📦 '}
                  {selectedTicket.claims.length} {selectedTicket.claims.length === 1 ? 'person has' : 'people have'} claimed this!
                </strong>
                {selectedTicket.claims.length <= 5 && (
                  <ul style={{ margin: 0, paddingLeft: '20px', color: (selectedTicket.claims.length >= 3) ? '#991b1b' : '#15803d', fontSize: '13px' }}>
                    {selectedTicket.claims.map((claim, idx) => {
                      const uname = claim.UserTable?.username || claim.user?.username || claim.claimant_rollno
                      const claimCredit = claim.UserTable?.social_credit ?? null
                      const isApproved = claim.ticket_status === 'approved'
                      const isPaid = claim.ticket_status === 'paid'
                      const isRequestTicket = selectedTicket.type === 'request'
                      // For request tickets: claimant can close when paid
                      const isThisClaimant = claim.claimant_rollno === user.rollno
                      const canClaimantClose = isRequestTicket && isPaid && isThisClaimant && !isClosed
                      return (
                        <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <NameTag username={uname} realName={studentNames?.[claim.claimant_rollno]} className="mp-detail-nametag" style={{ color: (selectedTicket.claims.length >= 3) ? '#991b1b' : '#15803d' }}>
                            <strong>@{uname}</strong>
                          </NameTag>
                          <CreditBadge score={claimCredit} size="xs" />
                          <UserCircle
                            size={15}
                            style={{ color: (selectedTicket.claims.length >= 3) ? '#991b1b' : '#15803d', cursor: 'pointer', flexShrink: 0, opacity: 0.7, transition: 'opacity 0.2s' }}
                            onClick={() => { setSelectedTicket(null); navigate(`/profile/${claim.claimant_rollno}`) }}
                            title="View profile"
                          />
                          {isPaid && (
                            <span className="mp-paid-funky"><Wallet size={12} /> {isRequestTicket ? 'Requestor Paid' : 'Paid'}</span>
                          )}
                          {isApproved && (
                            <span className="mp-approved-funky"><BadgeCheck size={12} /> Approved</span>
                          )}
                          {/* Owner actions: approve or close (for post tickets, or request tickets pre-paid) */}
                          {isOwner && !isClosed && !isRequestTicket && (
                            (isApproved || isPaid) ? (
                              <button
                                className="mp-close-for-claimant-btn"
                                onClick={(e) => { e.stopPropagation(); setCloseConfirmData({ ticket: selectedTicket, claimantRollno: claim.claimant_rollno, claimantName: uname }); setCloseComplaintDesc('') }}
                              >
                                <XCircle size={12} /> Close
                              </button>
                            ) : (
                              <button
                                className="mp-approve-btn"
                                onClick={(e) => { e.stopPropagation(); handleApprove(selectedTicket, claim.claimant_rollno) }}
                                disabled={approving === claim.claimant_rollno}
                                title="Approve this claimant"
                              >
                                {approving === claim.claimant_rollno ? <div className="mp-detail-btn-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <CheckCheck size={13} />}
                              </button>
                            )
                          )}
                          {/* Owner actions for request tickets: approve (pre-approved) or show paid status */}
                          {isOwner && !isClosed && isRequestTicket && !isApproved && !isPaid && (
                            <button
                              className="mp-approve-btn"
                              onClick={(e) => { e.stopPropagation(); handleApprove(selectedTicket, claim.claimant_rollno) }}
                              disabled={approving === claim.claimant_rollno}
                              title="Approve this claimant"
                            >
                              {approving === claim.claimant_rollno ? <div className="mp-detail-btn-spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : <CheckCheck size={13} />}
                            </button>
                          )}
                          {/* Claimant close button on request tickets when paid */}
                          {canClaimantClose && (
                            <button
                              className="mp-close-for-claimant-btn"
                              onClick={(e) => { e.stopPropagation(); setCloseConfirmData({ ticket: selectedTicket, claimantRollno: claim.claimant_rollno, claimantName: uname }); setCloseComplaintDesc('') }}
                            >
                              <XCircle size={12} /> Close
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Posted by */}
            <div className="mp-detail-user-row">
              <span className="mp-ticket-user-dot" />
              <span className="mp-detail-posted-by">
                Posted by <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag>
              </span>
              <CreditBadge score={selectedTicket.ownerCredit} size="md" />
              <UserCircle
                size={18}
                style={{ color: '#8b7355', cursor: 'pointer', marginLeft: 6, flexShrink: 0, transition: 'color 0.2s' }}
                onClick={() => { setSelectedTicket(null); navigate(`/profile/${selectedTicket.ownerRollno}`) }}
                title="View profile"
                id="detail-profile-link-owner"
              />
            </div>

            {/* ── Claimed / Approved state ── */}
            {hasClaimed && (() => {
              const userClaim = selectedTicket.claims?.find(c => c.claimant_rollno === user.rollno)
              const isPaidClaim = userClaim?.ticket_status === 'paid'
              const isApprovedClaim = userClaim?.ticket_status === 'approved'
              const isRequestTicket = selectedTicket.type === 'request'
              if (isPaidClaim) {
                // Request tickets: the OWNER paid the claimant, so claimant sees "Requestor paid you"
                if (isRequestTicket) return (
                  <div className="mp-detail-paid-banner" id="paid-banner">
                    <Wallet size={20} className="mp-detail-paid-icon" />
                    <div className="mp-detail-paid-text">
                      <strong>💰 The requestor has paid you!</strong>
                      <span><NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> has completed the payment. You can now close this ticket.</span>
                    </div>
                  </div>
                )
                // Post tickets: the CLAIMANT paid the owner
                return (
                  <div className="mp-detail-paid-banner" id="paid-banner">
                    <Wallet size={20} className="mp-detail-paid-icon" />
                    <div className="mp-detail-paid-text">
                      <strong>💰 You've marked this as paid!</strong>
                      <span>Waiting for <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to close the ticket.</span>
                    </div>
                  </div>
                )
              }
              if (isApprovedClaim) return (
                <div className="mp-detail-approved-banner" id="approved-banner">
                  <BadgeCheck size={20} className="mp-detail-approved-icon" />
                  <div className="mp-detail-approved-text">
                    <strong>🎉 Your claim has been approved!</strong>
                    <span>Reach out to <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to finalize.</span>
                  </div>
                </div>
              )
              return (
                <div className="mp-detail-claimed-banner" id="claimed-banner">
                  <CheckCircle2 size={20} className="mp-detail-claimed-icon" />
                  <div className="mp-detail-claimed-text">
                    <strong>You have claimed this ticket!</strong>
                  </div>
                </div>
              )
            })()}

            {/* ── Owner paid banner (request tickets) ── */}
            {isOwner && !isClosed && (() => {
              const isRequestTicket = selectedTicket.type === 'request'
              const paidClaim = selectedTicket.claims?.find(c => c.ticket_status === 'paid')
              if (isRequestTicket && paidClaim) {
                const helperName = paidClaim.UserTable?.username || paidClaim.claimant_rollno
                return (
                  <div className="mp-detail-paid-banner" id="owner-paid-banner">
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

            {/* ── Bargain prompt for non-claimants on tickets ── */}
            {!hasClaimed && !isOwner && !isClosed && selectedTicket.claims?.length > 0 && (
              <div className="mp-detail-bargain" id="bargain-section">
                <Gavel size={18} className="mp-detail-bargain-icon" />
                <div className="mp-detail-bargain-text">
                  <strong>Join the waitlist!</strong>
                  <span>Others have claimed this. Reach out to <NameTag username={selectedTicket.user} realName={studentNames?.[selectedTicket.ownerRollno]} className="mp-detail-nametag"><strong>@{selectedTicket.user}</strong></NameTag> to bargain!</span>
                </div>
              </div>
            )}

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

            {/* ── Action area ── */}
            <div className="mp-detail-actions">
              {!hasClaimed && !isClosed && !isOwner && (
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

              {/* Unclaim button — only if claimed and not paid */}
              {hasClaimed && !isOwner && !isClosed && (() => {
                const userClaim = selectedTicket.claims?.find(c => c.claimant_rollno === user.rollno)
                const isPaidClaim = userClaim?.ticket_status === 'paid'
                if (isPaidClaim) return null
                return (
                  <button
                    className="mp-detail-unclaim-btn"
                    onClick={() => handleUnclaim(selectedTicket)}
                    disabled={unclaiming}
                    id="unclaim-ticket-btn"
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

              {isOwner && !selectedTicket.claims?.length && !isClosed && (
                <div className="mp-detail-owner-note">
                  <AlertTriangle size={16} />
                  <span>This is your ticket — waiting for someone to claim it.</span>
                </div>
              )}

              {/* Owner close button — hide for request tickets where a claim is paid (claimant closes those) */}
              {isOwner && !isClosed && (() => {
                const isRequestTicket = selectedTicket.type === 'request'
                const hasPaidClaim = selectedTicket.claims?.some(c => c.ticket_status === 'paid')
                if (isRequestTicket && hasPaidClaim) return null
                return (
                  <div className="mp-detail-owner-claimed-actions">
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
                )
              })()}


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

      {/* ── Payment Popup for Approved Claims (QR Code Flow) ── */}
      {paymentPopupTicket && (
        <div
          className="mp-modal-overlay"
          onClick={() => { setPaymentPopupTicket(null); setPaymentPopupPayee(null); setPayStep(1); setPayAmount('') }}
          id="mp-payment-popup-overlay"
          style={{ zIndex: 350 }}
        >
          <div
            className="db-payment-popup"
            onClick={(e) => e.stopPropagation()}
            id="mp-payment-popup-card"
          >
            <button
              className="db-close-btn db-payment-close"
              onClick={() => { setPaymentPopupTicket(null); setPaymentPopupPayee(null); setPayStep(1); setPayAmount('') }}
              id="mp-payment-popup-close"
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
                <label className="db-pay-amount-label" htmlFor="mp-pay-amount-input">Negotiated Amount (₹)</label>
                <input
                  id="mp-pay-amount-input"
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
                  id="mp-pay-confirm-amount-btn"
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
                    id="mp-mark-paid-btn"
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

      {/* ── Paid Toast (funny) ── */}
      {paidToast && (
        <div className="db-toast" style={{ zIndex: 700 }}>
          <span className="db-toast-msg">{paidToast}</span>
        </div>
      )}

      {/* ── Close Confirmation Popup (High Contrast) ── */}
      {closeConfirmData && (
        <div
          className="mp-modal-overlay"
          onClick={() => { setCloseConfirmData(null); setCloseComplaintDesc('') }}
          id="close-confirm-overlay"
          style={{ zIndex: 360 }}
        >
          <div
            className="mp-close-confirm-card"
            onClick={(e) => e.stopPropagation()}
            id="close-confirm-card"
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

      {/* ── Help Modal ── */}
      {helpOpen && (
        <div className="mp-modal-overlay" onClick={() => setHelpOpen(false)} id="help-overlay">
          <div className="mp-help-modal" onClick={(e) => e.stopPropagation()} id="help-modal">
            <div className="mp-help-modal-pin" />
            <button className="mp-modal-close mp-detail-close" onClick={() => setHelpOpen(false)} id="help-close">
              <X size={16} />
            </button>

            <div className="mp-help-header">
              <h2 className="mp-help-title">How This Place Works</h2>
              <p className="mp-help-subtitle">A survival guide for the economically desperate</p>
            </div>

            <div className="mp-help-body">
              <div className="mp-help-section">
                <div className="mp-help-section-icon request-icon"><Megaphone size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Requests</h3>
                  <p className="mp-help-section-text">
                    Need something you definitely should have brought from home? Post a Request.
                    Other students will see your plea for help and (hopefully) take pity on you.
                    Think of it as a public announcement of your lack of preparation.
                  </p>
                </div>
              </div>

              <div className="mp-help-section">
                <div className="mp-help-section-icon offer-icon"><Package size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Offers</h3>
                  <p className="mp-help-section-text">
                    Got extra stuff? Feeling charitable? Or just entrepreneurial?
                    Post an Offer and let the marketplace know you are open for business.
                    You are basically a shopkeeper now. Congratulations on your new career.
                  </p>
                </div>
              </div>

              <div className="mp-help-section">
                <div className="mp-help-section-icon claim-icon"><ThumbsUp size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Claiming Tickets</h3>
                  <p className="mp-help-section-text">
                    See a ticket you can help with? Hit "Claim" to let the poster know
                    you are interested. Multiple people can claim the same ticket, so
                    think of it less like "dibs" and more like "standing in line at a concert."
                    The owner picks who they vibe with.
                  </p>
                </div>
              </div>

              <div className="mp-help-section">
                <div className="mp-help-section-icon price-icon"><CircleDollarSign size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Pricing and Negotiation</h3>
                  <p className="mp-help-section-text">
                    Every ticket can have a price. If someone sets "0" it means free (or they
                    forgot). If multiple people claim a ticket, the original poster gets to
                    pick who gets it.
                  </p>
                </div>
              </div>

              <div className="mp-help-section">
                <div className="mp-help-section-icon credit-icon"><Star size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Social Credit</h3>
                  <p className="mp-help-section-text">
                    Every user starts with 100 Social Credit (max 10,000). Help people and your
                    reputation grows. Annoy people and the admin might have fun with your score.
                  </p>
                </div>
              </div>

              <div className="mp-help-section">
                <div className="mp-help-section-icon dashboard-icon"><Zap size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Your Dashboard</h3>
                  <p className="mp-help-section-text">
                    Click your avatar in the top right to open the dashboard. You can see
                    your Social Credit score, your active tickets, tickets you have claimed,
                    and tickets that are closed. You can also close or delete tickets from
                    there.
                  </p>
                </div>
              </div>

              <div className="mp-help-section">
                <div className="mp-help-section-icon complain-icon"><Ticket size={18} /></div>
                <div>
                  <h3 className="mp-help-section-title">Complaints</h3>
                  <p className="mp-help-section-text">
                    Someone being shady? File a complaint from your dashboard.
                    The admin (Roll No 9999, fear them) reviews complaints and takes
                    action.
                  </p>
                </div>
              </div>

              <div className="mp-help-footer">
                <p>Still confused? Contact one of the creators:
                  mahithazari@gmail.com | nandu211020@gmail.com</p>
                <p className="mp-help-footer-small">If all else fails, just click buttons until something works.</p>
              </div>
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
