// ─── Disgusting Nickname Generator ──────────────────────────────
// Combines a compressed version of the real name with a revolting
// suffix/prefix from a curated list of horrors.

const GROSS_PREFIXES = [
  'Crusty', 'Soggy', 'Mushy', 'Slimy', 'Greasy',
  'Stinky', 'Funky', 'Moldy', 'Lumpy', 'Sweaty',
  'Grimy', 'Moist', 'Gooey', 'Rancid', 'Chunky',
  'Murky', 'Scabby', 'Grungy', 'Oozy', 'Flakey',
  'Drippy', 'Mangy', 'Burpy', 'Clammy', 'Ratty',
]

const GROSS_SUFFIXES = [
  'Goblin', 'Fungus', 'Worm', 'Pickle', 'Toenail',
  'Booger', 'Puddle', 'Nugget', 'Slime', 'Barnacle',
  'Maggot', 'Cockroach', 'Dumpster', 'Phlegm', 'Earwax',
  'Skunk', 'Squish', 'Belch', 'Scab', 'Sneeze',
  'Hairball', 'Mucus', 'Grease', 'Dandruff', 'Swamp',
]

/**
 * Compress a name if it's too long:
 * - Take first name fully (or first 5 chars if long)
 * - Strip vowels from last name and take first 4 consonants
 * - Mash together
 */
function compressName(fullName) {
  const parts = fullName.trim().split(/\s+/)
  let firstName = parts[0] || 'Anon'
  let lastName = parts.length > 1 ? parts[parts.length - 1] : ''

  // Cap first name at 5 chars
  if (firstName.length > 5) {
    firstName = firstName.slice(0, 5)
  }

  if (lastName) {
    // Strip vowels from last name, keep consonants
    const consonants = lastName.replace(/[aeiouAEIOU]/g, '')
    // Take first 4 consonants (or whatever's left)
    lastName = consonants.slice(0, 4)
  }

  let compressed = firstName + lastName
  // Ensure the compressed name is title-cased
  compressed = compressed.charAt(0).toUpperCase() + compressed.slice(1).toLowerCase()

  return compressed
}

/**
 * Generate a disgusting nickname from a real name.
 * Uses a deterministic-ish hash based on the name characters
 * so the same name always gets the same gross nickname.
 */
export function generateDisgustingNickname(realName) {
  if (!realName || !realName.trim()) {
    return 'CrustyAnon420'
  }

  // Simple hash from name characters for deterministic selection
  let hash = 0
  for (let i = 0; i < realName.length; i++) {
    hash = ((hash << 5) - hash) + realName.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  hash = Math.abs(hash)

  const prefix = GROSS_PREFIXES[hash % GROSS_PREFIXES.length]
  const suffix = GROSS_SUFFIXES[(hash >> 4) % GROSS_SUFFIXES.length]
  const compressed = compressName(realName)

  // Pick a pattern based on hash
  const patterns = [
    // PrefixName e.g. "CrustyMahtZr"
    () => `${prefix}${compressed}`,
    // NameSuffix e.g. "MahtZrFungus"
    () => `${compressed}${suffix}`,
    // PrefixNameNumber e.g. "SoggyMahtZr69"
    () => `${prefix}${compressed}${(hash % 99) + 1}`,
    // xX_Name_Xx style e.g. "xX_MahtZr_Xx"
    () => `xX_${compressed}${suffix}_Xx`,
    // Name_the_Suffix e.g. "MahtZr_the_Worm"
    () => `${compressed}_the_${suffix}`,
  ]

  const pattern = patterns[(hash >> 8) % patterns.length]
  return pattern()
}
