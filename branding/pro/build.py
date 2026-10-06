import os
OUT='/home/user/PTPN/branding/pro/'
RED='#e11d2e'; INK='#f4f4f5'; BG='#0b0b0d'

def mark(ink=INK, red=RED, bar1=None, bar2=None, skew=0):
    bar1 = bar1 or f'{ink}" fill-opacity=".28'
    bar2 = bar2 or f'{ink}" fill-opacity=".55'
    g = (f'<rect x="22" y="72" width="12" height="20" rx="2" fill="{bar1}"/>'
         f'<rect x="40" y="54" width="12" height="38" rx="2" fill="{bar2}"/>'
         f'<path d="M60 28h10v64h-10a2 2 0 0 1-2-2V30a2 2 0 0 1 2-2z" fill="{ink}"/>'
         f'<path d="M70 28h8a18 18 0 0 1 0 36h-8V52h8a6 6 0 0 0 0-12h-8z" fill="{red}"/>')
    if skew: g = f'<g transform="translate({60*0.0} 0) skewX({-skew})" style="transform-origin:60px 92px">{g}</g>'
    return g

def icon(skew=0, title='PTPN'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><title>{title}</title><rect width="120" height="120" rx="26" fill="{BG}"/>{mark(skew=skew)}</svg>'

# custom wordmark, letters drawn to match the mark (cap height 40, stem 8)
def P(x): return f'<path d="M{x} 0h8v40h-8zM{x+8} 0h8a12 12 0 0 1 0 24h-8v-8h8a4 4 0 0 0 0-8h-8z"/>'
def T(x): return f'<path d="M{x} 0h28v8h-10v32h-8V8h-10z"/>'
def N(x): return f'<path d="M{x} 0h8l16 25.5V0h8v40h-8L{x+8} 14.5V40h-8z"/>'.replace('l16 25.5V0h8','L'+str(x+24)+' 25.5V0h8')
def word(fill=INK, skew=0):
    letters = P(0)+T(38)+P(76)+N(114)
    t = f'skewX({-skew})' if skew else ''
    return f'<g fill="{fill}" transform="{t}">{letters}</g>', 146

def lockup(skew=0, ink=INK, red=RED, bg=BG, tag='#8a8a93'):
    w, ww = word(ink, skew)
    wx = 132 if skew else 118
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 344 120"><rect width="344" height="120" fill="{bg}"/>'
            f'<g transform="translate(0 0)">{mark(ink=ink, red=red, skew=skew)}</g>'
            f'<g transform="translate({wx} 28)">{w}</g>'
            f'<text x="{wx}" y="92" font-family="Inter,Helvetica,Arial,sans-serif" font-size="11.5" font-weight="600" letter-spacing="4.2" fill="{tag}">PERSONAL TRAINING</text></svg>')

for name, sk in (('straight', 0), ('italic', 10)):
    open(OUT+f'icon-{name}.svg','w').write(icon(sk, f'PTPN rising P ({name})'))
    open(OUT+f'lockup-{name}.svg','w').write(lockup(sk))
    open(OUT+f'lockup-{name}-light.svg','w').write(lockup(sk, ink='#0b0b0d', bg='#ffffff', tag='#6b6b73'))
    open(OUT+f'mono-{name}.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fff"/>{mark(ink="#0b0b0d", red="#0b0b0d", skew=sk)}</svg>')
print('ok')
