import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks.
 *
 * Isomorphe : dans le navigateur on s'appuie sur le `window` natif ; au rendu
 * serveur (SSR, Server Components) on fabrique un DOM virtuel via jsdom. jsdom
 * n'est jamais inclus dans le bundle navigateur (champ "browser" du package.json
 * + serverExternalPackages), le `require` ci-dessous n'y est donc pas résolu.
 *
 * Usage :
 *   import { sanitize } from '@/lib/security/sanitize'
 *   <div dangerouslySetInnerHTML={{ __html: sanitize(htmlString) }} />
 */
const CONFIG: Parameters<ReturnType<typeof DOMPurify>['sanitize']>[1] = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'figure', 'figcaption',
    'span', 'div', 'section', 'article', 'header', 'footer',
    'hr', 'sub', 'sup', 'mark',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'width', 'height',
    'class', 'id', 'style', 'target', 'rel',
    'colspan', 'rowspan',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.]+(?:[^a-z+.]|$))/i,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'oninput'],
}

let purify: ReturnType<typeof DOMPurify> | null = null

function getPurify(): ReturnType<typeof DOMPurify> {
  if (purify) return purify
  if (typeof window === 'undefined') {
    // Rendu serveur : DOM virtuel via jsdom (module externe côté serveur).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JSDOM } = require('jsdom') as typeof import('jsdom')
    purify = DOMPurify(new JSDOM('').window as unknown as Parameters<typeof DOMPurify>[0])
  } else {
    purify = DOMPurify(window)
  }
  return purify
}

export function sanitize(html: string | null | undefined): string {
  if (!html) return ''
  return getPurify().sanitize(html, CONFIG)
}
