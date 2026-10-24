import goldIcon from '../assets/favicon-gold.png?inline'

/** Replace stale HTML/Brave favicon entries with bundled gold image bytes. */
export function refreshTabIcon() {
  document.head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach(link => link.remove())
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.type = 'image/png'
  icon.sizes.add('32x32')
  icon.href = goldIcon
  document.head.append(icon)
}
