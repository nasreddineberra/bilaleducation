import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Uses DOMPurify with jsdom for SSR compatibility.
 *
 * Usage:
 *   import { sanitize } from '@/lib/security/sanitize'
 *   <div dangerouslySetInnerHTML={{ __html: sanitize(htmlString) }} />
 */
export function sanitize(html: string | null | undefined): string {
  if (!html) return ''

  // Create a virtual DOM for server-side sanitization
  const { window } = new JSDOM('')
  const purify = DOMPurify(window)

  return purify.sanitize(html, {
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
  })
}
