// Terms of Service and Privacy Policy. One source for both the in-game pages
// (Menu > Help) and the public pages at /terms and /privacy, which the build
// writes as plain HTML (vite.config.ts) for app stores and link sharing.
//
// DRAFTS: written by Claude for the owner to review. Not legal advice.
// Operator, contact and governing-law country (USA) from Kegan, 2026-10-13.

export type LegalBlock = string | { list: string[] }
export type LegalSection = { h: string; body: LegalBlock[] }
export type LegalDoc = { id: 'terms' | 'privacy'; title: string; updated: string; intro: string; sections: LegalSection[] }

export const DRAFT_NOTE = 'Draft: this page is being reviewed and may change before it is final.'
export const OPERATOR = 'Cartopia'
export const CONTACT = 'support@cartopia.lol'
export const JURISDICTION = 'the United States'

export const TERMS: LegalDoc = {
  id: 'terms',
  title: 'Terms of Service',
  updated: 'October 13, 2026',
  intro: `These terms are the rules for playing Cartopia, the town-building and racing game at cartopia.lol. ${OPERATOR} ("we", "us") runs the game. By playing or creating an account you agree to them. If you don't agree, please don't play.`,
  sections: [
    {
      h: 'Who can play',
      body: [
        'You must be at least 13 years old to create an account. If you are under the age of majority where you live, a parent or guardian must agree to these terms for you.',
        'You can play without an account. Your town is then saved only in your browser.',
      ],
    },
    {
      h: 'Your account',
      body: [
        'Keep your password private. You are responsible for what happens on your account. One account per person, please.',
        'Usernames, town names and crew names must follow the community rules below. We may change or remove a name that breaks them.',
      ],
    },
    {
      h: 'Coins, gems and other virtual items',
      body: [
        'Cartopia has in-game currencies (coins, gems and parts) and virtual items such as cars, paints, skins, mods, buildings and crate prizes.',
        {
          list: [
            'They have no real-world value. They cannot be sold, traded for money or cashed out.',
            'You get a licence to use them in the game. You do not own them.',
            'We may rebalance prices, rewards, odds and levels, and we may correct balances that come from bugs or cheating.',
            'Crate odds are shown in the game before you open a crate.',
          ],
        },
        'Cartopia does not sell anything for real money today. If we add purchases later, we will update these terms first and the price and what you get will be shown before you pay.',
      ],
    },
    {
      h: 'Fair play',
      body: [
        {
          list: [
            "No cheating, hacking, bots, scripts or editing your save or the game's traffic.",
            'No exploiting bugs. If you find one, tell us.',
            'No extra accounts to farm gifts, races or crew rewards.',
            "Don't try to get into other players' accounts or our servers.",
          ],
        },
      ],
    },
    {
      h: 'Community rules',
      body: [
        'Chat, usernames, town names, crews, taunts and gifts are shared with other players. Be kind.',
        {
          list: [
            'No harassment, hate, threats, sexual content, spam or scams.',
            "Don't share personal information, yours or anyone else's.",
            "Don't pretend to be someone else, including us.",
          ],
        },
        'Messages pass through a filter and can be removed. We may mute, limit or ban players who break these rules, with or without warning.',
      ],
    },
    {
      h: 'Your content',
      body: [
        'You keep what you write. You let us store it, show it to other players and use it to run the game, for as long as it stays in the game.',
      ],
    },
    {
      h: 'The game itself',
      body: [
        'Cartopia, its art, music, sounds and code belong to us or to the people who licensed them to us. Car and place names in the game are made up. Cartopia is not connected to any car maker or brand.',
        'The game is still being built. Features may change, pause or end, and saves can occasionally be lost. We do our best to keep your progress safe.',
      ],
    },
    {
      h: 'Ending things',
      body: [
        'You can stop playing at any time and delete your account in Menu > Account. We may suspend or close accounts that break these terms. Virtual items are lost when an account is closed.',
      ],
    },
    {
      h: 'Disclaimers and liability',
      body: [
        'Cartopia is provided "as is", without warranties of any kind, to the fullest extent the law allows. We are not liable for indirect or consequential losses, or for lost virtual items. Nothing here limits rights you have by law that cannot be limited.',
      ],
    },
    {
      h: 'Changes and law',
      body: [
        'We may update these terms. If a change is important we will tell you in the game. Playing after a change means you accept it.',
        `These terms are governed by the laws of ${JURISDICTION}.`,
      ],
    },
    { h: 'Contact', body: [`Questions? Email ${CONTACT}.`] },
  ],
}

export const PRIVACY: LegalDoc = {
  id: 'privacy',
  title: 'Privacy Policy',
  updated: 'October 13, 2026',
  intro: `This explains what Cartopia collects, why, and the choices you have. ${OPERATOR} ("we", "us") runs the game. We don't sell your data, show ads or use third-party tracking.`,
  sections: [
    {
      h: 'What we collect',
      body: [
        {
          list: [
            'Account: your email address and password (stored hashed by our sign-in provider). You can play without an account.',
            'Game data: your town, cars, progress, currencies, town name, username, friends, crew, races, gifts, taunts and likes.',
            'Chat: messages you send in chat and crew chat.',
            'Job alerts (only if you turn them on): a push address from your browser, plus when your jobs, fuel and restorations finish so we can tell you.',
            'Technical data: your IP address and browser details are seen by our hosting and database providers when the game loads, and kept briefly in their logs.',
          ],
        },
        'Settings such as volume, graphics and motion stay on your device. Seasons and time of day use your device clock and time zone, worked out on your device.',
      ],
    },
    {
      h: 'How we use it',
      body: [
        {
          list: [
            'To save your town and sync it between your devices.',
            'To run races, leaderboards, friends, crews, chat and gifts.',
            'To send the job alerts you asked for.',
            'To keep the game fair: check saves and purchases of virtual items, and stop cheating and abuse.',
            'To answer you when you contact us.',
          ],
        },
      ],
    },
    {
      h: 'What other players see',
      body: [
        'Your username, town name, level, your town when friends visit, your best car, race results and times, crew, leaderboard places and chat messages. Your email is never shown.',
      ],
    },
    {
      h: 'Who helps us run Cartopia',
      body: [
        {
          list: [
            'Supabase: database, sign-in and live updates (where your account and game data are stored).',
            'Netlify: hosts the game and sends job alerts.',
            "Your browser's push service (for example Google, Apple or Mozilla) delivers alerts if you turn them on.",
            'Google Fonts: serves the fonts the game uses.',
          ],
        },
        'They process data only to provide these services. Your data may be stored and processed outside your country.',
      ],
    },
    {
      h: 'Chat moderation',
      body: [
        'Chat messages pass through a word filter. Messages that break the community rules may be removed, and the accounts behind them muted or banned.',
      ],
    },
    {
      h: 'Purchases',
      body: [
        'Cartopia does not take real-money payments today. If we add them, a payment provider will handle your card details and we will update this policy first.',
      ],
    },
    {
      h: 'How long we keep it',
      body: [
        'We keep your account and game data while your account exists, along with one earlier copy of your save to recover from mistakes. When you delete your account, your account, save, friends, crew membership, chat messages and alerts are deleted. Provider logs expire on their own schedule.',
      ],
    },
    {
      h: 'Your choices',
      body: [
        {
          list: [
            'Download your data: Menu > Account > Export my data.',
            'Delete your account and data: Menu > Account > Delete account.',
            'Turn job alerts on or off in Menu > Settings, or in your browser.',
            `Ask us to see, correct or delete your data: email ${CONTACT}.`,
          ],
        },
        'Depending on where you live (for example the EU, UK or California) you may have more rights, such as objecting to processing or complaining to your data protection authority.',
      ],
    },
    {
      h: 'Children',
      body: [
        `Cartopia accounts are for players 13 and older. We don't knowingly collect personal data from younger children. If you think a child under 13 has an account, contact ${CONTACT} and we will delete it.`,
      ],
    },
    {
      h: 'Security',
      body: ['Data is sent over encrypted connections and protected by access rules on our database. No system is perfectly secure, so please use a unique password.'],
    },
    {
      h: 'Changes',
      body: ['We may update this policy. If a change is important we will tell you in the game.'],
    },
    { h: 'Contact', body: [`${OPERATOR}, ${CONTACT}.`] },
  ],
}

export const LEGAL = { terms: TERMS, privacy: PRIVACY }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The public page: plain HTML with inline styles, no scripts (the site's CSP
// only allows the game's own script).
export function legalHtml(doc: LegalDoc, other: LegalDoc): string {
  const body = doc.sections
    .map((s) => `<h2>${esc(s.h)}</h2>\n${s.body.map((b) => (typeof b === 'string' ? `<p>${esc(b)}</p>` : `<ul>${b.list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`)).join('\n')}`)
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(doc.title)} · Cartopia</title>
<meta name="description" content="${esc(doc.intro)}" />
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
<style>
body { margin: 0; background: #e8f4fd; color: #263238; font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
header { background: linear-gradient(#42a5f5, #1e88e5); color: #fff; padding: 22px 16px 18px; text-align: center; }
header a { color: #fff; text-decoration: none; font-weight: 800; letter-spacing: .5px; }
header h1 { margin: 6px 0 0; font-size: 28px; }
main { max-width: 720px; margin: -10px auto 32px; background: #fff; border-radius: 16px; padding: 20px 22px; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
h2 { font-size: 19px; margin: 22px 0 6px; color: #1565c0; }
.draft { background: #fff8e1; border: 2px solid #ffca28; border-radius: 10px; padding: 8px 12px; font-weight: 700; font-size: 14px; }
.meta { color: #78909c; font-size: 14px; }
ul { padding-left: 20px; }
footer { text-align: center; padding: 0 16px 32px; font-size: 14px; }
footer a { color: #1565c0; font-weight: 700; }
@media (prefers-color-scheme: dark) {
  body { background: #0f1720; color: #dfe6eb; }
  main { background: #18232e; box-shadow: none; }
  h2, footer a { color: #64b5f6; }
  .draft { background: #3a2f0b; border-color: #8d6e00; }
}
</style>
</head>
<body>
<header><a href="/">CARTOPIA</a><h1>${esc(doc.title)}</h1></header>
<main>
<p class="draft">${esc(DRAFT_NOTE)}</p>
<p class="meta">Last updated ${esc(doc.updated)}</p>
<p>${esc(doc.intro)}</p>
${body}
</main>
<footer><a href="/${other.id}">${esc(other.title)}</a> · <a href="/">Play Cartopia</a></footer>
</body>
</html>
`
}
