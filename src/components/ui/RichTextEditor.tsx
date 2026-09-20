'use client'

import { useEffect } from 'react'
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

const COLORS = [
  '#000000', '#374151', '#991b1b', '#92400e', '#166534',
  '#1e40af', '#6b21a8', '#be123c', '#ea580c', '#16a34a',
  '#2563eb', '#9333ea', '#dc2626', '#f59e0b', '#10b981',
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
        <div className="relative group">
          <Tooltip content="Couleur du texte">
            <button type="button" aria-label="Couleur du texte" className="p-1.5 rounded text-warm-700 hover:bg-warm-100">
              <Palette size={14} />
            </button>
          </Tooltip>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:grid grid-cols-5 gap-1 p-2 bg-white border border-warm-200 rounded-lg shadow-lg z-50">
            {COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="w-5 h-5 rounded-full border border-warm-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
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
