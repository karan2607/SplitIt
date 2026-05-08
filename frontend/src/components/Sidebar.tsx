import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Avatar from './Avatar'

type IconProps = { className?: string }

function GridIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeLinejoin="round" />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeLinejoin="round" />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeLinejoin="round" />
    </svg>
  )
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function UserIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}

function DashboardIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

const NAV = [
  { label: 'Dashboard', Icon: DashboardIcon, path: '/dashboard', match: (p: string) => p === '/dashboard' },
  { label: 'Groups',    Icon: GridIcon,      path: '/groups',    match: (p: string) => p === '/groups' || p.startsWith('/groups/') },
  { label: 'Friends',   Icon: UsersIcon,     path: '/friends',   match: (p: string) => p.startsWith('/friends') },
  { label: 'Profile',   Icon: UserIcon,      path: '/profile',   match: (p: string) => p.startsWith('/profile') },
]

interface Props {
  pendingFriendCount: number
}

export default function Sidebar({ pendingFriendCount }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-violet-950 border-r border-violet-900/60 z-40 transition-all duration-200 ease-in-out ${expanded ? 'w-56' : 'w-16'}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 shrink-0 overflow-hidden">
        <span className="text-2xl shrink-0">💸</span>
        {expanded && (
          <span className="ml-3 text-white font-bold text-lg tracking-tight whitespace-nowrap">SplitIt</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-2 overflow-hidden">
        {NAV.map(({ label, Icon, path, match }) => {
          const isActive = match(location.pathname)
          const isFriends = label === 'Friends'
          return (
            <div key={path} className="relative">
              <Link
                to={path}
                className={`flex items-center rounded-xl py-2.5 text-sm font-semibold transition-colors overflow-hidden ${
                  expanded ? 'px-3 gap-3' : 'justify-center px-0'
                } ${
                  isActive
                    ? 'bg-violet-700 text-white'
                    : 'text-violet-300 hover:bg-violet-800/60 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {expanded && <span className="whitespace-nowrap flex-1">{label}</span>}
                {expanded && isFriends && pendingFriendCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1">
                    {pendingFriendCount}
                  </span>
                )}
              </Link>
              {!expanded && isFriends && pendingFriendCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 pointer-events-none">
                  {pendingFriendCount}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-violet-900/60 p-3 shrink-0 overflow-hidden">
        {user && (
          <div className={`flex items-center gap-3 ${!expanded ? 'justify-center' : ''}`}>
            <Avatar user={user} size="sm" className="shrink-0" />
            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-xs text-violet-400 truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="shrink-0 text-violet-400 hover:text-rose-400 transition-colors"
                >
                  <LogoutIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
