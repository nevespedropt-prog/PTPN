import { demoUrl } from '../lib/util'
import Icon from './Icon'

// Small play button that opens the exercise on YouTube (or the coach's saved video) in a new tab.
export default function DemoLink({ name, url }: { name: string; url?: string }) {
  return <a className="btn icon demo-link" href={demoUrl(name, url)} target="_blank" rel="noopener noreferrer"
    aria-label={`Watch ${name} on YouTube`} title="Watch on YouTube" onClick={e => e.stopPropagation()}><Icon name="play" size={16} /></a>
}
