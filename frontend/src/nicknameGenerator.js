// ─── Witty Nickname Generator ──────────────────────────────────
// generates smooth-sounding handles that are subtly embarrassing.
// your real name is always in there. that's the bit.
// same name → same nickname → forever. the universe has decided.

// sensory / physical adjectives only.
// if it doesn't make you feel slightly gross, it's out.
const ADJECTIVES = [
  'Soggy', 'Musty', 'Crusty', 'Clammy', 'Damp',
  'Grimy', 'Stale', 'Pasty', 'Ashy', 'Tepid',
  'Lumpy', 'Muggy', 'Dingy', 'Feral', 'Salty',
  'Wheezy', 'Droopy', 'Moody', 'Dusty', 'Rusty',
]

// animals, foods, objects only — nothing that sounds cool.
// "barnacle" sticks. "oracle" flatters. keep barnacle.
const NOUNS = [
  'Pigeon', 'Walrus', 'Toad', 'Mole', 'Goblin',
  'Gremlin', 'Pelican', 'Barnacle', 'Anchovy', 'Turnip',
  'Biscuit', 'Pudding', 'Fungus', 'Urchin', 'Sponge',
  'Parsnip', 'Lint', 'Crumb', 'Yak', 'Moth',
]

// titles that confer fake dignity, making the rest worse by contrast
const TITLES = ['Sir', 'Lord', 'Duke', 'Chief', 'Elder']

/**
 * extracts a compact first name token (max 7 chars, title-cased).
 * "Lakshmi Madhulika" → "Lakshmi" → "Lakshmi" (already 7)
 * "Rajaneesh" → "Rajanee"
 */
function extractFirst(fullName) {
  const raw = fullName.trim().split(/\s+/)[0] || 'Anon'
  const clipped = raw.slice(0, 7)
  return clipped.charAt(0).toUpperCase() + clipped.slice(1).toLowerCase()
}

/**
 * deterministic hash — same string always yields the same integer.
 * this is the lock. the nickname never changes.
 */
function hashName(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i)
    h = h & h
  }
  return Math.abs(h)
}

/**
 * picks an item from an array using a hash offset, so each
 * component (adj, noun, title) draws from a different "lane"
 * of the hash — prevents them from clustering together.
 */
function pick(arr, hash, lane) {
  return arr[(hash >> lane) % arr.length]
}

/**
 * generates a nickname from a real name.
 * the real first name is always visible in the result.
 * compact: hard cap at 18 characters. falls back to AdjName if over.
 *
 * export name kept for backwards compat with App.jsx.
 */
export function generateDisgustingNickname(realName) {
  if (!realName || !realName.trim()) return 'SoggyAnon'

  const hash = hashName(realName)
  const name = extractFirst(realName)   // e.g. "eee"
  const adj = pick(ADJECTIVES, hash, 0) // e.g. "Clammy"
  const noun = pick(NOUNS, hash, 4) // e.g. "Barnacle"
  const title = pick(TITLES, hash, 8) // e.g. "Lord"

  // all patterns keep the real name visible.
  // ordered from subtlest to most unhinged.
  const patterns = [
    () => `${adj}${name}`,
    () => `${name}the${noun}`,
    () => `${title}${adj}${name}`,
    () => `${name}${noun}`,
    () => `${adj}${name}${noun}`,
  ]

  const raw = pick(patterns, hash, 12)()

  // hard cap at 18 chars. if over, fall back to the simplest form.
  if (raw.length > 18) return `${adj}${name}`

  return raw
}