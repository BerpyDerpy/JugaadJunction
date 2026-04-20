// ─── Absurd Disgusting Nickname Generator (Indian Edition) ─────
// Funny + Gross + Desi. Real name is NEVER cropped.

const ADJECTIVES = [
  'homophobic', 'racist', 'sexist',
  'simp', 'beta',
  'pajeet', 'streetshitter',
  'terrorist', 'jihadi', 'gandu',
  'harami', 'kamina',
  'gaand', 'shitty', 'pissy',
  'sweaty', 'oily', 'greasy', 'itchy', 'sticky', 'slimy'
]

// Short adjectives (used when name is long)
const SHORT_ADJECTIVES = [
  'homo', 'racist', 'simp', 'fag',
  'gandu', 'haram'
]

const TITLES = [
  'sir', 'shri', 'chief', 'anna', 'bhai', 'elder',
  'pandit', 'baba', 'swami', 'seth', 'raja', 'chacha',
  'mama', 'tau', 'bhaiya', 'ustad', 'guruji', 'sardar',
  'don', 'king', 'maharaj', 'acharya'
]

/**
 * Returns full first name without any cropping
 */
function extractFirst(fullName) {
  const raw = fullName.trim().split(/\s+/)[0] || 'Anon'
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

/**
 * Deterministic hash
 */
function hashName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

function pick(arr, hash, lane) {
  return arr[(hash >> lane) % arr.length]
}

/**
 * Chooses adjective list based on name length
 */
function getAdjectiveList(name) {
  return name.length > 8 ? SHORT_ADJECTIVES : ADJECTIVES
}

/**
 * Main generator - now respects full name length intelligently
 */
export function generateAbsurdDisgustingNickname(realName) {
  if (!realName || !realName.trim()) return 'HomoRaju'

  const hash = hashName(realName)
  const name = extractFirst(realName) // Full first name, e.g. "Yashwanth"
  const adjList = getAdjectiveList(name)
  const adj1 = pick(adjList, hash, 0)
  const adj2 = pick(adjList, hash, 4)
  const title = pick(TITLES, hash, 8)

  const patterns = [
    () => `${adj1}${name}`,                    // homoYashwanth
    () => `${adj1}${name}${title}`,            // homoYashwanthBhai
    () => `${adj2}${name}`,                    // ganduYashwanth        (single short)
  ]

  let raw = pick(patterns, hash, 12)()

  // Remove any spaces
  raw = raw.replace(/\s+/g, '')

  // Final safety cap - keep it reasonably short
  if (raw.length > 22) {
    return `${adj1}${name}` // fallback to single adj + full name
  }

  return raw
}