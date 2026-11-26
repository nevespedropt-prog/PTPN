// With a mouse, let people drag a chip row sideways (a phone already swipes). A drag never counts as a click on a chip.
export function enableChipDrag() {
  let row: HTMLElement | null = null, startX = 0, startLeft = 0, moved = false
  document.addEventListener('pointerdown', e => {
    moved = false
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = (e.target as HTMLElement | null)?.closest?.('.chips') as HTMLElement | null
    if (!el || el.scrollWidth <= el.clientWidth) return
    row = el; startX = e.clientX; startLeft = el.scrollLeft; moved = false
  })
  document.addEventListener('pointermove', e => {
    if (!row) return
    const dx = e.clientX - startX
    if (Math.abs(dx) > 5) moved = true
    if (moved) row.scrollLeft = startLeft - dx
  })
  const end = () => { row = null }
  document.addEventListener('pointerup', end)
  document.addEventListener('pointercancel', end)
  document.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false } }, true)
}
