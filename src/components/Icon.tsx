const paths = {
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  train: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  nutrition: 'M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9',
  progress: 'M4 19V5M4 19h16M8 15l3-4 3 2 4-6',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z',
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  clients: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 3-5 6-5s6 2 6 5M17 6a3 3 0 010 6M18 14c2 .5 3 2 3 5',
  library: 'M5 4h4v16H5zM11 4h4v16h-4zM16.6 4.8l3.7-.9 3 14.6-3.7.8z',
  inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  calendar: 'M5 5h14v14H5zM5 9h14M9 3v4M15 3v4',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  trophy: 'M8 4h8v5a4 4 0 01-8 0zM8 6H5v1a3 3 0 003 3M16 6h3v1a3 3 0 01-3 3M12 13v4M8 20h8M10 17h4',
  account: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 4-6 8-6s8 2 8 6',
  more: 'M4 12a1 1 0 102 0 1 1 0 00-2 0M11 12a1 1 0 102 0 1 1 0 00-2 0M18 12a1 1 0 102 0 1 1 0 00-2 0',
  plus: 'M12 5v14M5 12h14',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  play: 'M8 5l11 7-11 7z',
  check: 'M5 12l4 4 10-10',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  flame: 'M12 3s5 4 5 9a5 5 0 01-10 0c0-2 1-3 1-3s0 3 2 3c0-4 2-6 2-9z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  send: 'M4 12l16-8-6 16-3-7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  habits: 'M5 12l4 4 10-10M4 20h16',
  megaphone: 'M4 10v4h3l7 4V6l-7 4zM17 9a4 4 0 010 6',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
} as const

export type IconName = keyof typeof paths

export default function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
