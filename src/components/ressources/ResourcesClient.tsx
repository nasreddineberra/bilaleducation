'use client'

import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react'
import type { Room, Material, RoomType, MaterialCategory, MaterialCondition } from '@/types/database'

// ─── Labels ──────────────────────────────────────────────────────────────────

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  administration: 'Administration',
  bibliotheque: 'Bibliothèque',
  salle_cours: 'Salle de cours',
  salle_informatique: 'Salle informatique',
  salle_reunion: 'Salle de réunion',
  salle_sport: 'Salle de sport',
  autre: 'Autre',
}

const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  audiovisuel: 'Audiovisuel',
  fournitures: 'Fournitures',
  informatique: 'Informatique',
  mobilier: 'Mobilier',
  sport: 'Sport',
  autre: 'Autre',
}

const CONDITION_LABELS: Record<MaterialCondition, string> = {
  neuf: 'Neuf',
  bon: 'Bon état',
  use: 'Usé',
  hors_service: 'Hors service',
}

const CONDITION_COLORS: Record<MaterialCondition, string> = {
  neuf: 'bg-emerald-100 text-emerald-700',
  bon: 'bg-sky-100 text-sky-700',
  use: 'bg-amber-100 text-amber-700',
  hors_service: 'bg-red-100 text-red-700',
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  initialRooms: Room[]
  initialMaterials: (Material & { rooms?: { name: string } | null })[]
  etablissementId: string
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function ResourcesClient({ initialRooms, initialMaterials, etablissementId }: Props) {
  const supabase = createClient()

  // ── State Rooms ──
  const [rooms, setRooms] = useState(initialRooms)
  const [roomSearch, setRoomSearch] = useState('')
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [addingRoom, setAddingRoom] = useState(false)
  const [roomForm, setRoomForm] = useState<Partial<Room>>({})
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<string | null>(null)
  const [roomSaving, setRoomSaving] = useState(false)
  const [roomError, setRoomError] = useState('')

  // ── State Materials ──
  const [materials, setMaterials] = useState(initialMaterials)
  const [matSearch, setMatSearch] = useState('')
  const [editingMat, setEditingMat] = useState<Material | null>(null)
  const [addingMat, setAddingMat] = useState(false)
  const [matForm, setMatForm] = useState<Partial<Material>>({})
  const [confirmDeleteMat, setConfirmDeleteMat] = useState<string | null>(null)
  const [matSaving, setMatSaving] = useState(false)
  const [matError, setMatError] = useState('')

  // ── Filtered lists ──
  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
    ROOM_TYPE_LABELS[r.room_type].toLowerCase().includes(roomSearch.toLowerCase())
  )

  const filteredMats = materials.filter(m =>
    m.name.toLowerCase().includes(matSearch.toLowerCase()) ||
    MATERIAL_CATEGORY_LABELS[m.category].toLowerCase().includes(matSearch.toLowerCase())
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOMS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  const startAddRoom = () => {
    setAddingRoom(true)
    setEditingRoom(null)
    setRoomForm({ name: '', room_type: undefined as any, capacity: undefined, floor: '', description: '', is_available: true })
    setRoomError('')
  }

  const startEditRoom = (r: Room) => {
    setEditingRoom(r)
    setAddingRoom(false)
    setRoomForm({ ...r })
    setRoomError('')
  }

  const cancelRoom = () => { setAddingRoom(false); setEditingRoom(null); setRoomForm({}); setRoomError('') }

  const saveRoom = useCallback(async () => {
    if (!roomForm.name?.trim() || !roomForm.room_type) { setRoomError('Le nom et le type sont requis'); return }
    setRoomSaving(true); setRoomError('')
    try {
      if (editingRoom) {
        const { data, error } = await supabase.from('rooms').update({
          name: roomForm.name!.trim(),
          room_type: roomForm.room_type || 'salle_cours',
          capacity: roomForm.capacity || null,
          floor: roomForm.floor?.trim() || null,
          description: roomForm.description?.trim() || null,
          is_available: roomForm.is_available ?? true,
          updated_at: new Date().toISOString(),
        }).eq('id', editingRoom.id).select().single()
        if (error) throw error
        setRooms(prev => prev.map(r => r.id === editingRoom.id ? data : r).sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        const { data, error } = await supabase.from('rooms').insert({
          etablissement_id: etablissementId,
          name: roomForm.name!.trim(),
          room_type: roomForm.room_type || 'salle_cours',
          capacity: roomForm.capacity || null,
          floor: roomForm.floor?.trim() || null,
          description: roomForm.description?.trim() || null,
          is_available: roomForm.is_available ?? true,
        }).select().single()
        if (error) throw error
        setRooms(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      }
      cancelRoom()
    } catch (e: any) { setRoomError(e.message || 'Erreur') }
    finally { setRoomSaving(false) }
  }, [roomForm, editingRoom, supabase])

  const deleteRoom = useCallback(async (id: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') setRoomError('Impossible de supprimer : des ressources sont rattachées à cette salle')
      else setRoomError(error.message)
      setConfirmDeleteRoom(null)
      return
    }
    setRooms(prev => prev.filter(r => r.id !== id))
    setMaterials(prev => prev.map(m => m.room_id === id ? { ...m, room_id: undefined, rooms: null } : m))
    setConfirmDeleteRoom(null)
  }, [supabase])

  // ═══════════════════════════════════════════════════════════════════════════
  // MATERIALS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  const startAddMat = () => {
    setAddingMat(true)
    setEditingMat(null)
    setMatForm({ name: '', category: undefined as any, quantity: 1, condition: 'bon', room_id: undefined, serial_number: '', purchase_date: '', notes: '' })
    setMatError('')
  }

  const startEditMat = (m: Material) => {
    setEditingMat(m)
    setAddingMat(false)
    setMatForm({ ...m })
    setMatError('')
  }

  const cancelMat = () => { setAddingMat(false); setEditingMat(null); setMatForm({}); setMatError('') }

  const saveMat = useCallback(async () => {
    if (!matForm.name?.trim() || !matForm.category) { setMatError('Le nom et la catégorie sont requis'); return }
    setMatSaving(true); setMatError('')
    try {
      const payload = {
        name: matForm.name!.trim(),
        category: matForm.category || 'autre',
        quantity: matForm.quantity ?? 1,
        room_id: matForm.room_id || null,
        condition: matForm.condition || 'bon',
        serial_number: matForm.serial_number?.trim() || null,
        purchase_date: matForm.purchase_date || null,
        notes: matForm.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (editingMat) {
        const { data, error } = await supabase.from('materials').update(payload).eq('id', editingMat.id).select('*, rooms(name)').single()
        if (error) throw error
        setMaterials(prev => prev.map(m => m.id === editingMat.id ? data : m).sort((a, b) => a.name.localeCompare(b.name)))
      } else {
        const { data, error } = await supabase.from('materials').insert({
          etablissement_id: etablissementId,
          ...payload,
        }).select('*, rooms(name)').single()
        if (error) throw error
        setMaterials(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      }
      cancelMat()
    } catch (e: any) { setMatError(e.message || 'Erreur') }
    finally { setMatSaving(false) }
  }, [matForm, editingMat, supabase])

  const deleteMat = useCallback(async (id: string) => {
    const { error } = await supabase.from('materials').delete().eq('id', id)
    if (error) { setMatError(error.message); setConfirmDeleteMat(null); return }
    setMaterials(prev => prev.filter(m => m.id !== id))
    setConfirmDeleteMat(null)
  }, [supabase])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const roomFormValid = !!(roomForm.name?.trim() && roomForm.room_type)
  const matFormValid = !!(matForm.name?.trim() && matForm.category)

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-0">

        {/* ════════════════════ SALLES (gauche) ════════════════════ */}
        <div className="flex flex-col gap-2 pr-6">

          {/* Header + bouton ajouter */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Salles</h2>
            <button onClick={startAddRoom} className="flex items-center gap-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl px-3 py-1.5 transition-colors">
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-300" />
            <input value={roomSearch} onChange={e => setRoomSearch(e.target.value)} placeholder="Rechercher une salle..." className="input pl-9 !py-2 text-sm" />
          </div>

          {roomError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{roomError}</p>}

          {/* Add / Edit form */}
          {(addingRoom || editingRoom) && (
            <div className="card p-3 space-y-2">
              <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
                {editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Nom <span className="text-red-400">*</span></label>
                  <input value={roomForm.name ?? ''} onChange={e => setRoomForm(p => ({ ...p, name: e.target.value }))} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Type <span className="text-red-400">*</span></label>
                  <select value={roomForm.room_type ?? ''} onChange={e => setRoomForm(p => ({ ...p, room_type: e.target.value as RoomType }))} className="input mt-1">
                    <option value="" disabled>— Sélectionner un type —</option>
                    {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Capacité</label>
                  <input type="number" min={0} value={roomForm.capacity ?? ''} onChange={e => setRoomForm(p => ({ ...p, capacity: e.target.value ? Number(e.target.value) : undefined }))} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Étage</label>
                  <input value={roomForm.floor ?? ''} onChange={e => setRoomForm(p => ({ ...p, floor: e.target.value }))} className="input mt-1" />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={roomForm.is_available ?? true} onChange={e => setRoomForm(p => ({ ...p, is_available: e.target.checked }))} className="w-4 h-4 rounded accent-amber-500" />
                    <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Disponible</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Description</label>
                <textarea value={roomForm.description ?? ''} onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))} rows={2} className="input mt-1 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={cancelRoom} className="px-4 py-2 text-sm text-warm-600 hover:text-warm-800 rounded-xl transition-colors">Annuler</button>
                <button onClick={saveRoom} disabled={roomSaving || !roomFormValid} className={clsx('flex items-center gap-1.5 text-sm font-medium rounded-xl px-4 py-2 transition-colors', roomFormValid ? 'text-white bg-amber-500 hover:bg-amber-600' : 'text-warm-400 bg-warm-100 cursor-not-allowed')}>
                  <Check size={15} /> {roomSaving ? 'Enregistrement...' : editingRoom ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-2">
            {filteredRooms.length === 0 && <p className="text-sm text-warm-400 text-center py-6">Aucune salle</p>}
            {filteredRooms.map(r => (
              <div key={r.id} className={clsx('flex items-center justify-between gap-3 rounded-xl border px-3 py-1.5 transition-colors', r.is_available ? 'bg-white border-warm-100 hover:border-primary-300' : 'bg-warm-50 border-warm-200')}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-secondary-800 truncate">{r.name}</span>
                    {!r.is_available && <span className="text-[10px] bg-red-100 text-red-600 rounded-lg px-1.5 py-0.5 font-medium">Indisponible</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-warm-400 mt-0.5">
                    <span>{ROOM_TYPE_LABELS[r.room_type]}</span>
                    {r.capacity != null && <><span>·</span><span>{r.capacity} places</span></>}
                    {r.floor && <><span>·</span><span>{r.floor}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {confirmDeleteRoom === r.id ? (
                    <>
                      <button onClick={() => deleteRoom(r.id)} className="text-xs text-red-600 hover:text-red-700 font-medium px-2">Confirmer</button>
                      <button onClick={() => setConfirmDeleteRoom(null)} className="text-xs text-warm-400 hover:text-warm-600 px-2">Annuler</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditRoom(r)} className="p-1.5 text-warm-400 hover:text-secondary-600 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => { setConfirmDeleteRoom(r.id); setRoomError('') }} className="p-1.5 text-warm-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════ DIVIDER ════════════════════ */}
        <div className="hidden xl:block w-px bg-warm-200 mx-2" />

        {/* ════════════════════ MATÉRIELS (droite) ════════════════════ */}
        <div className="flex flex-col gap-2 pl-6 xl:pl-6 mt-6 xl:mt-0">

          {/* Header + bouton ajouter */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Matériels</h2>
            <button onClick={startAddMat} className="flex items-center gap-1 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl px-3 py-1.5 transition-colors">
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-300" />
            <input value={matSearch} onChange={e => setMatSearch(e.target.value)} placeholder="Rechercher un matériel..." className="input pl-9 !py-2 text-sm" />
          </div>

          {matError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{matError}</p>}

          {/* Add / Edit form */}
          {(addingMat || editingMat) && (
            <div className="card p-3 space-y-2">
              <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
                {editingMat ? 'Modifier le matériel' : 'Nouveau matériel'}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Nom <span className="text-red-400">*</span></label>
                  <input value={matForm.name ?? ''} onChange={e => setMatForm(p => ({ ...p, name: e.target.value }))} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Catégorie <span className="text-red-400">*</span></label>
                  <select value={matForm.category ?? ''} onChange={e => setMatForm(p => ({ ...p, category: e.target.value as MaterialCategory }))} className="input mt-1">
                    <option value="" disabled>— Sélectionner —</option>
                    {Object.entries(MATERIAL_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Quantité</label>
                  <input type="number" min={0} value={matForm.quantity ?? ''} onChange={e => setMatForm(p => ({ ...p, quantity: e.target.value ? Number(e.target.value) : 1 }))} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Date d'achat</label>
                  <input type="date" value={matForm.purchase_date ?? ''} onChange={e => setMatForm(p => ({ ...p, purchase_date: e.target.value }))} className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">État</label>
                  <select value={matForm.condition ?? 'bon'} onChange={e => setMatForm(p => ({ ...p, condition: e.target.value as MaterialCondition }))} className="input mt-1">
                    {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Salle</label>
                  <select value={matForm.room_id ?? ''} onChange={e => setMatForm(p => ({ ...p, room_id: e.target.value || undefined }))} className="input mt-1">
                    <option value="">— Aucune —</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">N° série</label>
                  <input value={matForm.serial_number ?? ''} onChange={e => setMatForm(p => ({ ...p, serial_number: e.target.value }))} className="input mt-1" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Notes</label>
                <textarea value={matForm.notes ?? ''} onChange={e => setMatForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input mt-1 resize-none" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={cancelMat} className="px-4 py-2 text-sm text-warm-600 hover:text-warm-800 rounded-xl transition-colors">Annuler</button>
                <button onClick={saveMat} disabled={matSaving || !matFormValid} className={clsx('flex items-center gap-1.5 text-sm font-medium rounded-xl px-4 py-2 transition-colors', matFormValid ? 'text-white bg-amber-500 hover:bg-amber-600' : 'text-warm-400 bg-warm-100 cursor-not-allowed')}>
                  <Check size={15} /> {matSaving ? 'Enregistrement...' : editingMat ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-2">
            {filteredMats.length === 0 && <p className="text-sm text-warm-400 text-center py-6">Aucun matériel</p>}
            {filteredMats.map(m => (
              <div key={m.id} className={clsx('flex items-center justify-between gap-3 rounded-xl border px-3 py-1.5 transition-colors', m.condition === 'hors_service' ? 'bg-warm-50 border-warm-200' : 'bg-white border-warm-100 hover:border-primary-300')}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-secondary-800 truncate">{m.name}</span>
                    <span className={clsx('text-[10px] rounded-lg px-1.5 py-0.5 font-medium', CONDITION_COLORS[m.condition])}>{CONDITION_LABELS[m.condition]}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-warm-400 mt-0.5">
                    <span>{MATERIAL_CATEGORY_LABELS[m.category]}</span>
                    <span>·</span>
                    <span>Qté : {m.quantity}</span>
                    {m.rooms?.name && <><span>·</span><span>{m.rooms.name}</span></>}
                    {m.serial_number && <><span>·</span><span>S/N {m.serial_number}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {confirmDeleteMat === m.id ? (
                    <>
                      <button onClick={() => deleteMat(m.id)} className="text-xs text-red-600 hover:text-red-700 font-medium px-2">Confirmer</button>
                      <button onClick={() => setConfirmDeleteMat(null)} className="text-xs text-warm-400 hover:text-warm-600 px-2">Annuler</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditMat(m)} className="p-1.5 text-warm-400 hover:text-secondary-600 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => { setConfirmDeleteMat(m.id); setMatError('') }} className="p-1.5 text-warm-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
