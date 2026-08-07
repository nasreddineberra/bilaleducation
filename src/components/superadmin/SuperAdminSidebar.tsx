'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, LogOut } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { clsx } from 'clsx'

interface SuperAdminSidebarProps {
  email?: string
}

export default function SuperAdminSidebar({ email }: SuperAdminSidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    try {
      await authRepository.signOut()
      router.push('/superadmin/login')
      router.refresh()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
  }

  useInactivityLogout(handleLogout)

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-screen overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image src="/icon.png" alt="" width={36} height={36} unoptimized className="flex-shrink-0 opacity-95" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Bilal</p>
            <p className="text-orange-400 font-bold text-sm leading-tight">Education</p>
          </div>
        </div>
        <div className="mt-3 px-2 py-1 rounded-lg bg-orange-500/15 inline-block">
          <span className="text-orange-400 text-xs font-semibold tracking-wide uppercase">
            Éditeur
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <Link
          href="/superadmin"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
            'outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60',
            pathname === '/superadmin' || pathname.startsWith('/superadmin/ecoles')
              ? 'bg-white/15 text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          )}
        >
          <Building2 className="w-[18px] h-[18px] flex-shrink-0" />
          Établissements
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center justify-between px-2">
          <p className="text-white/50 text-xs truncate max-w-[160px]">{email}</p>
          <button
            onClick={handleLogout}
            className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/10 rounded-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
            aria-label="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
