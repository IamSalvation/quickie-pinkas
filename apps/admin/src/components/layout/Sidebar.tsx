import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getPreset } from '../../lib/presets'
import { getSupportUnreadCounts } from '../../lib/api/support'

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { account, operator } = useAuth()
  const preset = getPreset(account?.preset)

  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await getSupportUnreadCounts()
      if (!cancelled) setUnread(data.unread_for_me)
    }

    load()
    const iv = setInterval(load, 20000)

    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [])

  const items: Array<{
    to: string
    label: string
    end: boolean
    badge?: number
  }> = [
    { to: '/dashboard', label: 'Dashboard', end: true },
    { to: '/participants', label: preset.labels.participants, end: false },
    { to: '/groups', label: preset.labels.groups, end: false },
    { to: '/programs', label: preset.labels.programs, end: false },
    { to: '/contexts', label: preset.labels.contexts, end: false },
    { to: '/kiosks', label: 'Kiosks', end: false },
    ...(preset.features.gradebook
      ? [{ to: '/grades', label: 'Grades', end: false }]
      : []),
    ...(preset.features.terms
      ? [{ to: '/terms', label: preset.value === 'university' ? 'Semesters' : 'Terms', end: false }]
      : []),
    { to: '/reports', label: 'Reports', end: false },
    { to: '/messages', label: 'Messages', end: false, badge: unread },
    { to: '/settings', label: 'Settings', end: false },
    { to: '/billing', label: 'Billing', end: false },
  ]

  return (
    <nav className="flex flex-col h-full bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="Quickie Pinkas" className="h-7 w-auto shrink-0" />
          <div className="text-base font-semibold truncate">Quickie Pinkas</div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {account?.name ?? 'Loading...'}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden text-2xl leading-none text-slate-400 hover:text-white px-1"
          >
            x
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              ].join(' ')
            }
          >
            <span>{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {item.badge}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>

      {operator?.is_platform_admin && (
        <div className="px-3 pb-3">
          <NavLink
            to="/platform"
            className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
          >
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-900">
              Platform
            </span>
            <span>Console</span>
          </NavLink>
        </div>
      )}

      <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
        {preset.label} - {account?.status ?? '-'}
      </div>
    </nav>
  )
}