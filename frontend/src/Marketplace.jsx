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
} from 'lucide-react'
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
function TicketCard({ ticket, index, type }) {
  const showTape  = index % 4 === 1
  const showStain = index % 5 === 3

  return (
    <div
      className={`mp-ticket ${pick(CARD_VARIANTS, index)}`}
      style={{ animationDelay: `${index * 0.06}s` }}
      id={`ticket-${ticket.id}`}
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
  // filter / search state
  const [activeFilter, setActiveFilter] = useState('All')
  const [searchQuery, setSearchQuery]   = useState('')

  // modal state
  const [modalOpen, setModalOpen] = useState(null) // 'request' | 'seller' | null
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc]   = useState('')
  const [formCategory, setFormCategory] = useState('')

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
          owner:UserTable!TicketTable_owner_rollno_fkey ( username ),
          metadata:TicketTableData ( title, description, category, status )
        `)
      
      if (error) throw error

      if (data) {
        const formattedTickets = data.map(t => {
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

  // filtering logic
  const filterTickets = (tickets) => {
    return tickets.filter((t) => {
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
          <div className="mp-topbar-avatar" id="user-avatar">{initials}</div>
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
                <TicketCard key={t.id} ticket={t} index={i} type="request" />
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
                <TicketCard key={t.id} ticket={t} index={i} type="seller" />
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

      {/* ── Modal ── */}
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
    </div>
  )
}
