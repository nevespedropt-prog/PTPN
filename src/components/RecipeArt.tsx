import { useState, type ReactNode } from 'react'
import { hue } from '../lib/util'

/** Banner for a recipe or meal plan: the photo when there is one, otherwise a coloured gradient. */
export default function RecipeArt({ name, url, tall, children }: { name: string; url?: string | null; tall?: boolean; children?: ReactNode }) {
  const [broken, setBroken] = useState(false)
  const photo = !!url && !broken
  return (
    <div className={'recipe-art' + (photo ? ' has-photo' : '') + (tall ? ' tall' : '')} style={{ ['--h' as string]: hue(name) }}>
      {photo && <img className="photo" src={url!} alt="" loading="lazy" onError={() => setBroken(true)} />}
      {children}
      {!photo && <span className="initial" aria-hidden="true">{name[0]}</span>}
    </div>
  )
}

export function PhotoCredit({ credit }: { credit?: string | null }) {
  if (!credit) return null
  return <span className="photo-credit">Photo: <a href={credit} target="_blank" rel="noopener noreferrer">Pexels</a></span>
}
