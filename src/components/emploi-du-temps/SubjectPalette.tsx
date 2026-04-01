'use client'

import { useDraggable } from '@dnd-kit/core'
import { BookOpen } from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaletteSubject {
  /** UE subject string stored in class_teachers.subject (e.g. "MATH — Mathématiques") */
  subject: string
  /** UE display name */
  ueName: string
  /** UE code */
  ueCode: string | null
  /** UE color */
  color: string | null
  /** Assigned teacher id (empty string if unassigned) */
  teacherId: string
  /** Assigned teacher display name */
  teacherName: string
}

interface Props {
  subjects: PaletteSubject[]
}

// ─── Draggable subject card ─────────────────────────────────────────────────

function DraggableSubject({ item }: { item: PaletteSubject }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.subject}`,
    data: { type: 'new-subject', subject: item },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={clsx(
        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all select-none',
        isDragging ? 'opacity-30 scale-95' : 'hover:shadow-sm hover:border-warm-300',
        'bg-white border-warm-200',
      )}
    >
      {/* Color dot */}
      <span
        className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
        style={{ backgroundColor: item.color ?? '#94a3b8' }}
      />

      {/* Subject info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-secondary-800 truncate">
          {item.ueCode ? `${item.ueCode} — ` : ''}{item.ueName}
        </p>
        <p className="text-[10px] text-warm-400 truncate">
          {item.teacherName || 'Non affecté'}
        </p>
      </div>
    </div>
  )
}

// ─── Palette ────────────────────────────────────────────────────────────────

export default function SubjectPalette({ subjects }: Props) {
  if (subjects.length === 0) {
    return (
      <div className="w-48 flex-shrink-0 border-r border-warm-100 bg-warm-50/50 p-3">
        <h3 className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-2">Matières</h3>
        <div className="flex items-center gap-2 text-xs text-warm-400 py-4">
          <BookOpen size={14} />
          Aucune matière affectée.
        </div>
      </div>
    )
  }

  return (
    <div className="w-48 flex-shrink-0 border-r border-warm-100 bg-warm-50/50 p-3 overflow-y-auto">
      <h3 className="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-2">
        Matières ({subjects.length})
      </h3>
      <div className="space-y-1.5">
        {subjects.map(item => (
          <DraggableSubject key={item.subject} item={item} />
        ))}
      </div>
    </div>
  )
}
