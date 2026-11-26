// Several panels (sheets, the menu) can be open at once. Each takes a lock and the page only scrolls again
// when every lock is released, so closing them in any order can never leave the page stuck.
let locks = 0
export function lockScroll(): () => void {
  if (locks++ === 0) document.body.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    if (--locks <= 0) { locks = 0; document.body.style.overflow = '' }
  }
}
