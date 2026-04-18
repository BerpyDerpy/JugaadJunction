import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import {
  X,
  Bell,
  ShoppingBag,
  Package,
  Megaphone,
  ArrowLeft,
} from 'lucide-react'
import './Dashboard.css'

// ── Card styling helpers (same as Marketplace) ─────────────────
const CARD_VARIANTS = ['variant-cream', 'variant-blue', 'variant-yellow', 'variant-pink', 'variant-green']
const PIN_COLORS   = ['pin-red', 'pin-yellow', 'pin-green', 'pin-blue', 'pin-orange']
function pick(arr, i) { return arr[i % arr.length] }

// ── Credit Score Wheel ─────────────────────────────────────────
function CreditWheel({ score, max = 100 }) {
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
function DashTicketCard({ ticket, index, type }) {
  const showTape  = index % 4 === 1
  const showStain = index % 5 === 3

  return (
    <div
      className={`mp-ticket ${pick(CARD_VARIANTS, index)}`}
      style={{ animationDelay: `${index * 0.06}s` }}
      id={`dash-ticket-${ticket.id}`}
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

  useEffect(() => {
    fetchUserTickets()
  }, [])

  const fetchUserTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('TicketTable')
        .select(`
          ticketid,
          type,
          owner_rollno,
          owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
          metadata:TicketTableData ( title, description, category, status )
        `)
        .eq('owner_rollno', user.rollno)

      if (error) throw error

      if (data) {
        const formatted = data.map(t => {
          const ownerObj = Array.isArray(t.owner) ? t.owner[0] : t.owner
          const username = ownerObj ? ownerObj.username : 'unknown'
          const meta = Array.isArray(t.metadata) ? t.metadata[0] : t.metadata || {}

          return {
            id: String(t.type === 'request' ? 'REQ-' : 'SEL-') + t.ticketid,
            title: meta.title || 'Untitled',
            desc: meta.description || '',
            category: meta.category || 'General',
            user: username,
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
    () => tickets.filter(t => t.type === 'post'),
    [tickets]
  )
  const requested = useMemo(
    () => tickets.filter(t => t.type === 'request'),
    [tickets]
  )

  const activeList = activeTab === 'posted' ? posted : requested
  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??'

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
          <CreditWheel score={user?.credit_score ?? 75} />
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
            Posted ({posted.length})
          </button>
          <button
            className={`db-tab ${activeTab === 'requested' ? 'active' : ''}`}
            onClick={() => setActiveTab('requested')}
            id="tab-requested"
          >
            <Megaphone size={16} />
            Requested ({requested.length})
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
                />
              ))}
            </div>
          ) : (
            <div className="db-empty">
              <div className="db-empty-icon">
                {activeTab === 'posted' ? '📦' : '📣'}
              </div>
              <p>
                {activeTab === 'posted'
                  ? "You haven't posted any offers yet."
                  : "You haven't made any requests yet."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
