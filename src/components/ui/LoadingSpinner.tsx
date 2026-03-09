export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-warm-200 border-t-primary" />
        <p className="text-sm text-warm-400">Chargement…</p>
      </div>
    </div>
  )
}
