const paths: Record<string, string> = {
  programme: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  progress: 'M4 19V5M4 19h16M8 15l3-4 3 2 4-6',
  book: 'M5 5h14v14H5zM5 9h14M9 3v4M15 3v4',
  clients: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 3-5 6-5s6 2 6 5M17 6a3 3 0 010 6M18 14c2 .5 3 2 3 5',
  slots: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  account: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 4-6 8-6s8 2 8 6',
}

export default function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
