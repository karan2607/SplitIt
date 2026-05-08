import { Link, useLocation } from 'react-router-dom'

const NAV = [
  { label: 'Home',    emoji: '⌂',  path: '/dashboard', match: (p: string) => p === '/dashboard' },
  { label: 'Groups',  emoji: '⊞', path: '/groups',    match: (p: string) => p === '/groups' || p.startsWith('/groups/') },
  { label: 'Friends', emoji: '👥', path: '/friends',   match: (p: string) => p.startsWith('/friends') },
  { label: 'Profile', emoji: '👤', path: '/profile',   match: (p: string) => p.startsWith('/profile') },
]

interface Props {
  pendingFriendCount: number
}

export default function BottomNav({ pendingFriendCount }: Props) {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-violet-950 border-t border-violet-900/60 flex">
      {NAV.map(({ label, emoji, path, match }) => {
        const isActive = match(pathname)
        const isFriends = label === 'Friends'
        return (
          <div key={path} className="relative flex-1">
            <Link
              to={path}
              className={`flex flex-col items-center justify-center py-2 w-full transition-colors ${
                isActive ? 'text-white' : 'text-violet-400'
              }`}
            >
              <span className="text-xl leading-none">{emoji}</span>
              <span className="text-[10px] font-semibold mt-0.5">{label}</span>
            </Link>
            {isFriends && pendingFriendCount > 0 && (
              <span className="absolute top-1.5 left-1/2 translate-x-2 min-w-[16px] h-4 flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1 pointer-events-none">
                {pendingFriendCount}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
