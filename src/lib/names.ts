// Keeps slurs and crude words out of the names other players see:
// town names, crew names, tags and mottos. public.name_ok() in the database uses the same
// lists for crews (supabase/migrations/0015_security_hardening.sql; names.test.ts checks).

// Matched anywhere inside a name once it is squashed (so "N i g g a" and "n1gg@" count).
export const ANYWHERE = [
  'nigg', 'nigr', 'niga', 'nlgg', 'faggot', 'fagot', 'faggit', 'kike', 'chink', 'spic', 'wetback', 'beaner',
  'tranny', 'retard', 'raghead', 'towelhead', 'coon', 'gook', 'paki', 'dyke', 'kkk', 'hitler', 'nazi',
  'fuck', 'fuk', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'cock', 'dick', 'pussy', 'penis', 'vagina',
  'porn', 'rape', 'molest', 'pedo', 'jizz', 'twat', 'wank', 'bastard', 'asshole', 'dildo', 'anal',
]
// Only matched as a whole word, because they hide inside harmless words ("class", "Scunthorpe").
export const WHOLE_WORD = ['ass', 'fag', 'nig', 'tit', 'tits', 'sex', 'hoe', 'hoes', 'jap', 'homo', 'cum']
// Harmless words that contain a blocked piece.
export const ALLOWED = ['cocktail', 'peacock', 'hitchcock', 'dickens', 'scunthorpe', 'cockpit', 'shuttlecock', 'raccoon', 'cocoon', 'tycoon', 'spice', 'spicy', 'conspicuous', 'racoon', 'torpedo', 'pedometer', 'cockatoo', 'cockroach', 'gamecock', 'cumulus', 'cucumber', 'circumference', 'document', 'analog', 'analysis', 'canal', 'banal', 'pakistan', 'grape', 'drape', 'scrape', 'therapist']

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' }

const unleet = (s: string) => s.toLowerCase().replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? c)

export function isCleanName(name: string): boolean {
  let text = unleet(name)
  for (const ok of ALLOWED) text = text.split(ok).join(' ')
  const squashed = text.replace(/[^a-z]/g, '')
  if (ANYWHERE.some((w) => squashed.includes(w))) return false
  const words = text.split(/[^a-z]+/).filter(Boolean)
  return !words.some((w) => WHOLE_WORD.includes(w))
}

// What other players see when a name breaks the rules.
export function displayName(name: string, id: string, kind: 'town' | 'crew' = 'town') {
  if (isCleanName(name)) return name
  return `${kind === 'crew' ? 'Crew' : 'Town'} #${id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()}`
}

export const NAME_REJECTED = "That name isn't allowed. Try something else."
