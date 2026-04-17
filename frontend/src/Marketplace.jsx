import { useState, useMemo } from 'react'
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

// ─── Dummy ticket data ──────────────────────────────────────────
const SEED_REQUESTS = [
  {
    id: 'REQ-001',
    title: 'Need 2 A4 sheets urgently',
    desc: 'Have a lab record submission in 20 min. Will return tomorrow!',
    category: 'A4',
    user: 'priya_22',
    status: 'pending',
  },
  {
    id: 'REQ-002',
    title: 'USB-C to HDMI adaptor for presentation',
    desc: 'ESE project demo in Room 304 at 2 PM. Can anyone lend one for an hour?',
    category: 'Adaptors',
    user: 'rahul_k',
    status: 'claimed',
  },
  {
    id: 'REQ-003',
    title: 'Anyone have short notes for DSA?',
    desc: 'Mid-2 prep. Digital or handwritten both fine.',
    category: 'Short Notes',
    user: 'aishu_07',
    status: 'pending',
  },
  {
    id: 'REQ-004',
    title: 'Phone charger (Type-C)',
    desc: 'Dead phone, important call expected. Library area please!',
    category: 'Charging Equipment',
    user: 'alex_m',
    status: 'pending',
  },
  {
    id: 'REQ-005',
    title: 'Lab record sheets — OS subject',
    desc: '5 plain observation sheets. Will buy you a coffee ☕',
    category: 'Record Stuff',
    user: 'sneha_r',
    status: 'closed',
  },
  {
    id: 'REQ-006',
    title: 'Buddy for badminton 4 PM',
    desc: 'Looking for a doubles partner at the court, anyone free?',
    category: 'Leisure Buddy System',
    user: 'vikram_s',
    status: 'pending',
  },
  {
    id: 'REQ-007',
    title: 'Output printout — 3 pages',
    desc: 'Java lab output, need colour print if possible.',
    category: 'Output Printouts',
    user: 'megha_26',
    status: 'pending',
  },
  {
    id: 'REQ-008',
    title: 'Proxy attendance lol (jk… unless?)',
    desc: 'Stuck in hostel with fever. DM me 🥲',
    category: 'Attendance',
    user: 'karan_d',
    status: 'closed',
  },
]

const SEED_SELLER_POSTS = [
  {
    id: 'SEL-001',
    title: 'Selling 50 extra A4 sheets',
    desc: 'Bought a ream, only used half. ₹30 for the lot, meet near canteen.',
    category: 'A4',
    user: 'divya_p',
    status: 'pending',
  },
  {
    id: 'SEL-002',
    title: 'Homemade laddoos 🍬',
    desc: 'Mom sent a huge box. ₹10 per piece, limited stock!',
    category: 'Snacks',
    user: 'anand_j',
    status: 'claimed',
  },
  {
    id: 'SEL-003',
    title: 'Stationery kit — pens, pencils, ruler',
    desc: 'Brand new Faber-Castell set. Moving out of hostel, selling cheap.',
    category: 'Stationery',
    user: 'meera_v',
    status: 'pending',
  },
  {
    id: 'SEL-004',
    title: 'Water bottle (Milton 1L)',
    desc: 'Bought two by mistake. Sealed, unused. ₹150.',
    category: 'Water Bottle',
    user: 'ravi_k',
    status: 'pending',
  },
  {
    id: 'SEL-005',
    title: 'DBMS assignment solutions',
    desc: 'Handwritten, neatly done. Will share photos for ₹20.',
    category: 'Homework & Assignments',
    user: 'nandini_s',
    status: 'pending',
  },
  {
    id: 'SEL-006',
    title: 'Lightning to USB-C adapter',
    desc: 'Works perfectly, no longer need it. ₹100.',
    category: 'Adaptors',
    user: 'sai_m',
    status: 'closed',
  },
  {
    id: 'SEL-007',
    title: 'Lending my portable charger',
    desc: '20 000 mAh Ambrane. Return by evening. DM me.',
    category: 'Charging Equipment',
    user: 'pooja_b',
    status: 'pending',
  },
  {
    id: 'SEL-008',
    title: 'CN short notes — handwritten',
    desc: '40 pages covering Units 1-4. Neat diagrams included.',
    category: 'Short Notes',
    user: 'arjun_22',
    status: 'claimed',
  },
]

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

  const closeModal = () => {
    setModalOpen(null)
    setFormTitle('')
    setFormDesc('')
    setFormCategory('')
  }

  const handleSubmit = () => {
    // UI-only — no backend wiring yet
    closeModal()
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
    () => filterTickets(SEED_REQUESTS),
    [activeFilter, searchQuery]
  )
  const filteredSeller = useMemo(
    () => filterTickets(SEED_SELLER_POSTS),
    [activeFilter, searchQuery]
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
