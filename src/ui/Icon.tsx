// Game UI icons. Glyphs are one colour (currentColor) so the theme decides
// their colour; currency icons carry their own colours.

const GLYPHS = {
  shop: (
    <>
      <path d="M3 4h18l1.5 5a3 3 0 0 1-5.25 2 3 3 0 0 1-5.25 0 3 3 0 0 1-5.25 0A3 3 0 0 1 1.5 9Z" />
      <path fillRule="evenodd" d="M3.5 12.6a4.4 4.4 0 0 0 3.5-.4 4.5 4.5 0 0 0 5 0 4.5 4.5 0 0 0 5 0 4.4 4.4 0 0 0 3.5.4V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Zm3 2.4v6h4v-6Zm7 0v3.5h4V15Z" />
    </>
  ),
  car: (
    <path fillRule="evenodd" d="M6.2 5.5A2 2 0 0 1 8.1 4h7.8a2 2 0 0 1 1.9 1.5L19 10h.5A2.5 2.5 0 0 1 22 12.5V17a1 1 0 0 1-1 1h-1v1.5a1.5 1.5 0 0 1-3 0V18H7v1.5a1.5 1.5 0 0 1-3 0V18H3a1 1 0 0 1-1-1v-4.5A2.5 2.5 0 0 1 4.5 10H5Zm2.3.5-.9 4h8.8l-.9-4ZM6 12.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm12 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
  ),
  wrench: (
    <path d="M21.4 6.3a.6.6 0 0 0-1-.3l-3 3-2.6-.8-.8-2.6 3-3a.6.6 0 0 0-.3-1 6 6 0 0 0-7.2 7.6l-7.6 7.6a2.4 2.4 0 0 0 3.4 3.4l7.6-7.6a6 6 0 0 0 7.5-7.3Z" />
  ),
  friends: (
    <>
      <circle cx="8.5" cy="7.5" r="3.5" />
      <path d="M1.5 19.5c0-3.6 3-6 7-6s7 2.4 7 6a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1Z" />
      <circle cx="17" cy="8.5" r="2.8" />
      <path d="M16.6 13.5c3.4.1 5.9 2.2 5.9 5.3a.8.8 0 0 1-.8.7h-4.6a7.6 7.6 0 0 0-2.4-5.6 7 7 0 0 1 1.9-.4Z" />
    </>
  ),
  cone: (
    <>
      <path d="M10.3 3h3.4l1.1 4H9.2Zm-1.6 6h6.6l1.1 4H7.6Zm-1.6 6h9.8l1.3 4.5H5.8Z" />
      <rect x="2.5" y="19.5" width="19" height="2.5" rx="1" />
    </>
  ),
  flag: (
    <path fillRule="evenodd" d="M4 2.5a1 1 0 0 1 1 1V4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5v6.5a1 1 0 0 1-2 0v-18a1 1 0 0 1 1-1ZM5 6v3h3.5V6Zm3.5 3v3H12V9Zm3.5 0h3.5V6H12Zm3.5 0v3H19V9Z" />
  ),
  trophy: (
    <path fillRule="evenodd" d="M6 2.5h12V4h3a1 1 0 0 1 1 1v1.5a5 5 0 0 1-4.6 5 6 6 0 0 1-3.9 3.3V17H16a2 2 0 0 1 2 2v2.5H6V19a2 2 0 0 1 2-2h2.5v-2.2a6 6 0 0 1-3.9-3.3A5 5 0 0 1 2 6.5V5a1 1 0 0 1 1-1h3ZM4 6v.5a3 3 0 0 0 2.1 2.9A6 6 0 0 1 6 8.5V6Zm16 0h-2v2.5l-.1.9A3 3 0 0 0 20 6.5Z" />
  ),
  // Free camera: a building with a path circling it.
  orbit: (
    <>
      <path d="M12 5.5 16.2 8.8V15H7.8V8.8Z" />
      <path d="M19.6 10.6c1.5.8 2.4 1.8 2.4 2.9 0 2.5-4.5 4.5-10 4.5S2 16 2 13.5c0-1.2 1.1-2.3 2.9-3.1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M10.6 15.2 14.4 18l-3.8 2.8Z" />
    </>
  ),
  // Back to the bird's-eye view: town blocks seen from above.
  birdseye: (
    <>
      <path d="M12 2.5 16.5 7 12 11.5 7.5 7Z" />
      <path d="M6.5 8 11 12.5 6.5 17 2 12.5Z" />
      <path d="M17.5 8 22 12.5 17.5 17 13 12.5Z" />
      <path d="M12 13.5 16.5 18 12 22.5 7.5 18Z" />
    </>
  ),
  goals: (
    <path fillRule="evenodd" d="M9 2h6a1 1 0 0 1 1 1v1h2.5A1.5 1.5 0 0 1 20 5.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-15A1.5 1.5 0 0 1 5.5 4H8V3a1 1 0 0 1 1-1Zm1 2v1.5h4V4Zm5.8 6.2a1 1 0 0 0-1.5-1.3l-3.6 4.3-1.7-1.6a1 1 0 0 0-1.4 1.4l2.5 2.4a1 1 0 0 0 1.5-.1Zm-7.3 7.3a1 1 0 0 0 0 2h7a1 1 0 0 0 0-2Z" />
  ),
  soundOn: (
    <>
      <path d="M3 9.5A1.5 1.5 0 0 1 4.5 8H7l4.6-3.8a.9.9 0 0 1 1.4.7v14.2a.9.9 0 0 1-1.4.7L7 16H4.5A1.5 1.5 0 0 1 3 14.5Z" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  soundOff: (
    <>
      <path d="M3 9.5A1.5 1.5 0 0 1 4.5 8H7l4.6-3.8a.9.9 0 0 1 1.4.7v14.2a.9.9 0 0 1-1.4.7L7 16H4.5A1.5 1.5 0 0 1 3 14.5Z" />
      <path d="m16 9 6 6m0-6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  menu: <path d="M4 5.5h16a1.5 1.5 0 0 1 0 3H4a1.5 1.5 0 0 1 0-3Zm0 5h16a1.5 1.5 0 0 1 0 3H4a1.5 1.5 0 0 1 0-3Zm0 5h16a1.5 1.5 0 0 1 0 3H4a1.5 1.5 0 0 1 0-3Z" />,
  crate: <path fillRule="evenodd" d="M3 6.5 12 2l9 4.5v11L12 22l-9-4.5Zm2.2 1.7v8.1l5.7 2.9v-8.1Zm7.9 11 5.7-2.9V8.2l-5.7 2.9ZM12 4.4 6.6 7.1 12 9.8l5.4-2.7ZM6.4 12.4l3.4 1.7v1.6l-3.4-1.7Z" />,
  chat: <path fillRule="evenodd" d="M4.5 3h15A2.5 2.5 0 0 1 22 5.5v10a2.5 2.5 0 0 1-2.5 2.5H11l-5.2 3.8A.8.8 0 0 1 4.5 21v-3A2.5 2.5 0 0 1 2 15.5v-10A2.5 2.5 0 0 1 4.5 3Zm3 6.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm4.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm4.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />,
  bolt: <path d="M13.5 1.5 4 13.5h6.5l-1.5 9 9.5-12h-6.5Z" />,
  gift: (
    <path fillRule="evenodd" d="M8 2.5a3 3 0 0 1 4 1.2 3 3 0 0 1 4-1.2A2.8 2.8 0 0 1 17.6 7H21a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h3.4A2.8 2.8 0 0 1 8 2.5Zm.5 2a1 1 0 0 0-.3 2H11a3 3 0 0 0-2.5-2Zm7 0A3 3 0 0 0 13 6.5h2.8a1 1 0 0 0-.3-2ZM3.5 13.5H11V22H5a1.5 1.5 0 0 1-1.5-1.5Zm9.5 0h7.5v7A1.5 1.5 0 0 1 19 22h-6Z" />
  ),
  star: <path d="M12 1.8a1.2 1.2 0 0 1 1.1.7l2.6 5.3 5.8.8a1.2 1.2 0 0 1 .7 2.1l-4.2 4.1 1 5.8a1.2 1.2 0 0 1-1.8 1.3L12 19.2l-5.2 2.7A1.2 1.2 0 0 1 5 20.6l1-5.8-4.2-4.1a1.2 1.2 0 0 1 .7-2.1l5.8-.8 2.6-5.3a1.2 1.2 0 0 1 1.1-.7Z" />,
  tag: <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 1 4 2.5h7.4a2 2 0 0 1 1.4.6l8.4 8.4a2 2 0 0 1 0 2.8l-7.4 7.4a2 2 0 0 1-2.8 0L2.6 13.3a2 2 0 0 1-.6-1.4Zm5 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />,
  road: <path fillRule="evenodd" d="M8 2h8l5 20H3Zm3 2.5v3h2v-3Zm0 5.5v3.5h2V10Zm0 6v4h2v-4Z" />,
  bulldoze: (
    <>
      <path d="M3 9.5h7V5h5l2 4.5v6H3Z" />
      <path d="M17.5 11h2.5l2.5 6.5H19Z" />
      <path fillRule="evenodd" d="M5 16h10a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6Zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </>
  ),
  move: <path d="M12 1.5 16 5.5h-2.8v5.3h5.3V8l4 4-4 4v-2.8h-5.3v5.3H16l-4 4-4-4h2.8v-5.3H5.5V16l-4-4 4-4v2.8h5.3V5.5H8Z" />,
  land: <path fillRule="evenodd" d="M1.5 5.2 8 3l8 2.5 6.5-2.3v15.6L16 21l-8-2.5-6.5 2.3ZM9 5.4v11.7l6 1.9V7.3Z" />,
  merge: <path fillRule="evenodd" d="M3 3h8v8H3Zm10 0h8v8h-8ZM3 13h8v8H3Zm10 0h8v8h-8Zm-2.6-5 1.2-1 1.2 1-1.2 1Z" />,
  rotate: <path d="M12 3a9 9 0 0 1 8.4 5.8l1.6-1V13h-5.2l1.8-1.1A6 6 0 1 0 18 15.5l2.6 1.4A9 9 0 1 1 12 3Z" />,
  up: <path d="M12 2.5 21 12h-5.5v9.5h-7V12H3Z" />,
  back: <path d="M15.6 3.4a1.8 1.8 0 0 1 0 2.5L9.5 12l6.1 6.1a1.8 1.8 0 0 1-2.5 2.5l-7.4-7.3a1.8 1.8 0 0 1 0-2.6l7.4-7.3a1.8 1.8 0 0 1 2.5 0Z" />,
  check: <path d="M20.3 5.3a1.6 1.6 0 0 1 .1 2.3l-10 11a1.6 1.6 0 0 1-2.3.1l-5-4.8a1.6 1.6 0 1 1 2.2-2.3l3.8 3.7 8.9-9.8a1.6 1.6 0 0 1 2.3-.2Z" />,
  close: <path d="M6.3 4.2 12 9.9l5.7-5.7a1.5 1.5 0 0 1 2.1 2.1L14.1 12l5.7 5.7a1.5 1.5 0 0 1-2.1 2.1L12 14.1l-5.7 5.7a1.5 1.5 0 0 1-2.1-2.1L9.9 12 4.2 6.3a1.5 1.5 0 0 1 2.1-2.1Z" />,
  filter: <path d="M3.5 4h17a1 1 0 0 1 .8 1.6L14.5 14v5.4a1 1 0 0 1-.6.9l-2.6 1.2a1 1 0 0 1-1.4-.9V14L2.7 5.6A1 1 0 0 1 3.5 4Z" />,
  sort: <path d="M7 3 11.5 8H8.5v13h-3V8h-3Zm10 18-4.5-5h3V3h3v13h3Z" />,
  plus: <path d="M12 3.5a1.8 1.8 0 0 1 1.8 1.8v4.9h4.9a1.8 1.8 0 0 1 0 3.6h-4.9v4.9a1.8 1.8 0 0 1-3.6 0v-4.9H5.3a1.8 1.8 0 0 1 0-3.6h4.9V5.3A1.8 1.8 0 0 1 12 3.5Z" />,
}

export type IconName = keyof typeof GLYPHS

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className ? `gi ${className}` : 'gi'} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      {GLYPHS[name]}
    </svg>
  )
}

// Currency icons: full colour, drawn to read at 16-28px.
export function CoinIcon({ size = 24 }: { size?: number }) {
  return (
    <svg className="cur" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12.8" r="10.5" fill="#b86e00" />
      <circle cx="12" cy="11.6" r="10.5" fill="#ffc533" />
      <circle cx="12" cy="11.6" r="7.6" fill="#ffd95c" stroke="#e8a20c" strokeWidth="1.4" />
      <path d="M12.9 6.8v1a3 3 0 0 1 2.3 1.6l-1.5.8a1.6 1.6 0 0 0-1.6-.9c-.8 0-1.3.4-1.3.9 0 .6.6.8 1.7 1.1 1.7.4 3 1 3 2.7 0 1.3-1 2.3-2.6 2.5v1h-1.6v-1a3.2 3.2 0 0 1-2.6-1.8l1.5-.8a1.8 1.8 0 0 0 1.8 1.1c.9 0 1.4-.4 1.4-1s-.6-.8-1.8-1.1c-1.5-.4-2.8-1-2.8-2.6 0-1.2.9-2.2 2.4-2.5v-1Z" fill="#a35f00" />
    </svg>
  )
}

export function BuckIcon({ size = 24 }: { size?: number }) {
  return (
    <svg className="cur" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M7 3.5h10l5 6.2L12 21.8 2 9.7Z" fill="#0d5fb3" transform="translate(0 1)" />
      <path d="M7 3.5h10l5 6.2L12 21.8 2 9.7Z" fill="#35a8ff" />
      <path d="M7 3.5h10l5 6.2H2Z" fill="#8fd3ff" />
      <path d="m7 3.5 2.5 6.2L12 3.5l2.5 6.2L17 3.5M2 9.7h20M9.5 9.7 12 21.8l2.5-12.1" fill="none" stroke="#1676d2" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M8 5h2.3l-1.4 3.4L7 6.3Z" fill="#fff" opacity=".8" />
    </svg>
  )
}

export function PartsIcon({ size = 24 }: { size?: number }) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315]
  return (
    <svg className="cur" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <g transform="translate(0 1)" fill="#4a5560">
        {teeth.map((a) => <rect key={a} x="10" y="1" width="4" height="5" rx="1" transform={`rotate(${a} 12 12)`} />)}
        <circle cx="12" cy="12" r="7.5" />
      </g>
      <g fill="#a9b6c2">
        {teeth.map((a) => <rect key={a} x="10" y="1" width="4" height="5" rx="1" transform={`rotate(${a} 12 12)`} />)}
        <circle cx="12" cy="12" r="7.5" />
      </g>
      <circle cx="12" cy="12" r="5.6" fill="#cfd8e0" />
      <circle cx="12" cy="12" r="2.8" fill="#4a5560" />
    </svg>
  )
}

export function FuelIcon({ size = 24 }: { size?: number }) {
  return (
    <svg className="cur" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M7 2.5h5l1.5 1.5H18a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" fill="#9b1c1c" transform="translate(0 1)" />
      <path d="M7 2.5h5l1.5 1.5H18a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" fill="#f04438" />
      <path d="M8.5 1.5h4v3h-4Z" fill="#3a4148" />
      <path d="M12 9.5c1.8 2.4 3 4 3 5.6a3 3 0 0 1-6 0c0-1.6 1.2-3.2 3-5.6Z" fill="#fff" />
      <path d="M6 9.2 8.6 6.5H17" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
