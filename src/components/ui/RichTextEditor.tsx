'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { clsx } from 'clsx'
import Tooltip from './Tooltip'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link as LinkIcon, Undo2, Redo2, Palette,
} from 'lucide-react'

interface Props {
  content: string
  onChange: (html: string) => void
}

/**
 * Couleurs de texte proposees dans la barre d'outils.
 *
 * CE SONT DES COULEURS D'ENCRE, PAS D'APLAT. Le HTML compose ici part dans des
 * EMAILS, dont la carte est verrouillee en fond blanc (`color-scheme: only
 * light`) : chaque valeur est donc mesuree sur #ffffff et tient le seuil WCAG AA
 * du petit texte (4,5:1). Les 15 valeurs Tailwind d'origine, choisies a la main,
 * en avaient QUATRE sous le seuil — ambre a 2,15 et emeraude a 2,54 : un parent
 * ne lisait pas un devoir ecrit dans ces teintes.
 *
 * L'orange et le bleu de la charte sont ASSOMBRIS a dessein : a leur valeur
 * d'aplat (#cc8200 = 3,11 et #2a78d6 = 4,42) ils echouent comme texte.
 *
 * Pas de vert : aucun n'est a la fois lisible, distinct du teal de marque et
 * dans la charte — le teal tient ce role.
 *
 * Toute valeur ajoutee ici se mesure d'abord sur blanc.
 */
const COLORS: { hex: string; nom: string }[] = [
  { hex: '#1f2e35', nom: 'Encre' },      // 14,00 — defaut du corps de mail
  { hex: '#0c5b51', nom: 'Marque' },     //  7,98 — teal profond
  { hex: '#1d5aa8', nom: 'Bleu' },       //  6,82
  { hex: '#4a3aa7', nom: 'Violet' },     //  8,56
  { hex: '#b3261e', nom: 'Rouge' },      //  6,54
  { hex: '#a35c00', nom: 'Orange' },     //  5,14
]

/**
 * Bouton de la barre d'outils. AU NIVEAU DU MODULE, et non dans le composant :
 * defini a l'interieur, il etait un NOUVEAU type a chaque rendu — React
 * demontait et remontait les douze boutons a chaque frappe (focus perdu,
 * infobulle refermee en plein clic).
 */
function Btn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <Tooltip content={title}>
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className={clsx(
        'p-1.5 rounded transition-colors',
        active ? 'bg-primary-100 text-primary-700' : 'text-warm-700 hover:bg-warm-100'
      )}
    >
      {children}
    </button>
    </Tooltip>
  )
}

export default function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none px-3 py-2 min-h-[180px] focus:outline-none',
      },
    },
  })

  // TipTap ne lit `content` qu'à la création. Quand le parent remet le corps
  // à zéro après un envoi, l'éditeur gardait l'ancien texte (vu le 20/09).
  // Garde d'égalité : à chaque frappe le parent reçoit `getHTML()`, la prop
  // vaut donc déjà le contenu et rien n'est réécrit — pas de boucle, pas de
  // curseur déplacé.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [editor, content])

  // ── Panneau de couleurs : au CLIC, pas au survol ────────────────────────
  //
  // Au survol, le panneau s'ouvrait 4 px sous le bouton alors que le groupe ne
  // fait que la hauteur du bouton (un enfant absolu ne l'agrandit pas) : ces
  // 4 px etaient une ZONE MORTE, il fallait un geste rapide pour traverser
  // (signale a l'ecran le 21/09). Coller le panneau aurait rafistole le
  // symptome ; le survol reste inatteignable au CLAVIER et inexistant au
  // TOUCHER. Le clic regle les trois.
  //
  // PAS de calque de fermeture plein ecran (motif du menu « ... » de l'EDT) :
  // la, absorber le clic est le but, sinon il atteindrait le creneau dessous.
  // Ici, cliquer dans le texte doit fermer le panneau ET poser le curseur.
  // Un ecouteur de document laisse donc passer le clic.
  const [colorOpen, setColorOpen] = useState(false)
  const colorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!colorOpen) return
    const auClic = (e: MouseEvent) => {
      if (!colorRef.current?.contains(e.target as Node)) setColorOpen(false)
    }
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') setColorOpen(false) }
    document.addEventListener('mousedown', auClic)
    document.addEventListener('keydown', auClavier)
    return () => {
      document.removeEventListener('mousedown', auClic)
      document.removeEventListener('keydown', auClavier)
    }
  }, [colorOpen])

  if (!editor) return null


  const handleLink = () => {
    const url = window.prompt('URL du lien :', editor.getAttributes('link').href ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  return (
    <div className="border border-warm-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-warm-100 bg-warm-50">
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
          <Bold size={14} />
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
          <Italic size={14} />
        </Btn>
        <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligner">
          <UnderlineIcon size={14} />
        </Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barrer">
          <Strikethrough size={14} />
        </Btn>

        <span className="w-px h-5 bg-warm-200 mx-1" />

        <Btn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Aligner a gauche">
          <AlignLeft size={14} />
        </Btn>
        <Btn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrer">
          <AlignCenter size={14} />
        </Btn>
        <Btn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Aligner a droite">
          <AlignRight size={14} />
        </Btn>

        <span className="w-px h-5 bg-warm-200 mx-1" />

        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste a puces">
          <List size={14} />
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numerotee">
          <ListOrdered size={14} />
        </Btn>
        <Btn active={editor.isActive('link')} onClick={handleLink} title="Lien">
          <LinkIcon size={14} />
        </Btn>

        <span className="w-px h-5 bg-warm-200 mx-1" />

        {/* Color picker */}
        <div className="relative" ref={colorRef}>
          <Tooltip content="Couleur du texte">
            <button
              type="button"
              aria-label="Couleur du texte"
              aria-haspopup="true"
              aria-expanded={colorOpen}
              onClick={() => setColorOpen(o => !o)}
              className={clsx(
                'p-1.5 rounded hover:bg-warm-100',
                colorOpen ? 'bg-warm-100 text-secondary-800' : 'text-warm-700'
              )}
            >
              <Palette size={14} />
            </button>
          </Tooltip>
          {/* Colonnes de largeur EXPLICITE et `w-max` : le panneau est en
              `position:absolute`, donc sa largeur se calcule sur son contenu, et
              des colonnes en `1fr` (ce que rend `grid-cols-6`) n'y contribuent
              pour rien. Le conteneur se repliait et les pastilles debordaient en
              se chevauchant (vu a l'ecran le 21/09). */}
          {colorOpen && (
            <div className="absolute top-full left-0 mt-1 grid w-max grid-cols-[repeat(6,1.25rem)] gap-1.5 p-2 bg-white border border-warm-200 rounded-lg shadow-lg z-50">
              {COLORS.map(({ hex, nom }) => (
                <Tooltip key={hex} content={nom}>
                  <button
                    type="button"
                    aria-label={`Couleur ${nom}`}
                    // `.focus()` de la chaine rend la main au texte : on
                    // continue a ecrire sans reprendre la souris.
                    onClick={() => { editor.chain().focus().setColor(hex).run(); setColorOpen(false) }}
                    className="block w-5 h-5 rounded-full border border-warm-200 hover:scale-110 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    style={{ backgroundColor: hex }}
                  />
                </Tooltip>
              ))}
            </div>
          )}
        </div>

        <span className="w-px h-5 bg-warm-200 mx-1" />

        <Btn active={false} onClick={() => editor.chain().focus().undo().run()} title="Annuler">
          <Undo2 size={14} />
        </Btn>
        <Btn active={false} onClick={() => editor.chain().focus().redo().run()} title="Retablir">
          <Redo2 size={14} />
        </Btn>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}
