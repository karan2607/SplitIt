import type { User } from '../lib/api'

const COLORS = [
  'bg-violet-500',
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-teal-500',
  'bg-pink-500',
]

function colorFor(name: string): string {
  const i = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length
  return COLORS[i]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const SIZE_CLASSES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
}

interface Props {
  user: Pick<User, 'name'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Avatar({ user, size = 'md', className = '' }: Props) {
  return (
    <div
      className={`${SIZE_CLASSES[size]} ${colorFor(user.name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {initials(user.name)}
    </div>
  )
}
