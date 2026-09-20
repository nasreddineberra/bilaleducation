import DOMPurify from 'dompurify'

/**
 * Sanitize HTML content to prevent XSS attacks.
 *
 * Isomorphe : dans le navigateur on s'appuie sur le `window` natif ; au rendu
 * serveur (SSR, Server Components) on fabrique un DOM virtuel via jsdom. jsdom
 * n'est jamais inclus dans le bundle navigateur (champ "browser" du package.json
 * + serverExternalPackages), le `require` ci-dessous n'y est donc pas résolu.
 *
 * ── jsdom EST ÉPINGLÉ EN 26.1.0, NE PAS LE REMONTER SANS LIRE CECI ─────────
 *
 * Vercel lance ses fonctions avec `--no-experimental-require-module` : le
 * `require()` d'un module ESM y échoue (ERR_REQUIRE_ESM), même sur Node 24.
 * Or jsdom >= 27.4 charge `@exodus/bytes` (ESM pur) par un `require()` interne
 * à `html-encoding-sniffer`. Constaté le 20 septembre 2026 sur le premier envoi
 * réel : les trois actions qui sanitisent côté serveur (message parents,
 * message staff, relance) tombaient en erreur #441 avant tout enregistrement.
 * 26.1.0 est la dernière version dont toute la chaîne est en CommonJS.
 *
 * Reproduire en local, avec le drapeau de Vercel :
 *   node --no-experimental-require-module -e "require('jsdom')"
 * Remonter jsdom le jour où cette commande passe avec la version visée.
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
  // ── PAS d'`ALLOWED_URI_REGEXP` ICI, C'EST VOULU ──────────────────────────
  //
  // Il y en avait une, recopiee a la main depuis DOMPurify, et deux caracteres
  // manquaient a sa classe negative — le tiret et, surtout, les DEUX-POINTS :
  //
  //   nous    [a-z+.]+(?:[^a-z+.]|$)        <- « javascript » puis « : » passent
  //   defaut  [a-z+.\-]+(?:[^a-z+.\-:]|$)   <- les deux-points sont exclus
  //
  // Consequence mesuree le 16 aout : `javascript:alert(1)` ET
  // `data:text/html,<script>` SURVIVAIENT a la sanitisation, alors que le
  // defaut de DOMPurify bloque les deux. Un enseignant pouvait donc placer un
  // lien executable dans un devoir, declenche dans la session de qui l'ouvre —
  // direction comprise. Ouvert depuis le 9 juillet.
  //
  // Cette expression n'apportait RIEN que le defaut n'ait deja : `cid:` y
  // figure, et il accepte en plus `sms:`. Elle ne faisait qu'affaiblir.
  //
  // REGLE : ne jamais recopier une expression de securite d'une bibliotheque.
  // Si un protocole manque un jour, l'ajouter par `ADD_URI_SAFE_ATTR` ou en
  // derivant explicitement du defaut, jamais en le retranscrivant.
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
