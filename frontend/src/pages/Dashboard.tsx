import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api, type DashboardData, type DashboardBalance, type Group } from '../lib/api'
import { useToast } from '../components/Toast'
import { useGroups } from '../hooks/useGroup'
import Avatar from '../components/Avatar'
import PageHeader from '../components/PageHeader'
import { SkeletonGroupCard } from '../components/Skeleton'

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const GROUP_COLORS = [
  { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   badge: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-sky-50',    border: 'border-sky-200',    badge: 'bg-sky-100 text-sky-700' },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-teal-50',   border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700' },
  { bg: 'bg-pink-50',   border: 'border-pink-200',   badge: 'bg-pink-100 text-pink-700' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
]

function SectionHeader({ title, linkLabel, onLink }: { title: string; linkLabel?: string; onLink?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold text-gray-800">{title}</h2>
      {linkLabel && onLink && (
        <button onClick={onLink} className="text-xs text-violet-600 hover:underline font-medium">{linkLabel}</button>
      )}
    </div>
  )
}

function BalanceCard({ balance, currentUserId, onGoToGroup }: {
  balance: DashboardBalance
  currentUserId: string
  onGoToGroup: (groupId: string) => void
}) {
  const iOwe = balance.from_user.id === currentUserId
  const other = iOwe ? balance.to_user : balance.from_user
  const amount = parseFloat(balance.amount)

  return (
    <div className={`bg-white rounded-2xl border-l-4 ${iOwe ? 'border-l-rose-400' : 'border-l-emerald-400'} border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3`}>
      <Avatar user={other} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          {iOwe ? `You owe ${other.name}` : `${other.name} owes you`}
        </p>
        <p className="text-xs text-gray-400">{balance.group.name}</p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={`text-base font-bold ${iOwe ? 'text-rose-600' : 'text-emerald-600'}`}>
          ${amount.toFixed(2)}
        </span>
        <button
          onClick={() => onGoToGroup(balance.group.id)}
          className="text-xs text-violet-600 border border-violet-200 hover:bg-violet-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          Go to group →
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { groups, isLoading: groupsLoading, refetch: refetchGroups } = useGroups()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashLoading, setDashLoading] = useState(true)

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  useEffect(() => {
    if (!user) return
    api.dashboard.get()
      .then(setDashboard)
      .catch(() => showToast('Could not load dashboard', 'error'))
      .finally(() => setDashLoading(false))
  }, [user])

  function goToGroup(groupId: string, tab?: string) {
    navigate(`/groups/${groupId}${tab ? `?tab=${tab}` : ''}`)
  }

  const owedToMe = parseFloat(dashboard?.total_owed_to_me ?? '0')
  const iOwe = parseFloat(dashboard?.total_i_owe ?? '0')
  const netBalance = owedToMe - iOwe

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`Hi, ${firstName} 👋`}
      />

      <main className="px-6 py-6 max-w-4xl">

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className={`rounded-2xl border px-4 py-4 shadow-sm ${owedToMe > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Owed to you</p>
            <p className={`text-2xl font-bold ${owedToMe > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
              ${dashLoading ? '—' : owedToMe.toFixed(2)}
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-4 shadow-sm ${iOwe > 0 ? 'bg-rose-50 border-rose-100' : 'bg-white border-gray-100'}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">You owe</p>
            <p className={`text-2xl font-bold ${iOwe > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
              ${dashLoading ? '—' : iOwe.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Net balance</p>
            <p className={`text-2xl font-bold ${netBalance > 0 ? 'text-emerald-600' : netBalance < 0 ? 'text-rose-600' : 'text-gray-400'}`}>
              {dashLoading ? '—' : `${netBalance >= 0 ? '+' : ''}$${netBalance.toFixed(2)}`}
            </p>
          </div>
        </div>

        {/* Action needed */}
        {!dashLoading && dashboard && dashboard.balances.length > 0 && (
          <div className="mb-8">
            <SectionHeader title="Action needed" />
            <div className="space-y-2">
              {dashboard.balances.map((b, i) => (
                <BalanceCard
                  key={i}
                  balance={b}
                  currentUserId={user!.id}
                  onGoToGroup={(id) => goToGroup(id, 'balances')}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="mb-8">
          <SectionHeader title="Recent activity" />
          {dashLoading && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-200 rounded w-40" />
                    <div className="h-3 bg-gray-100 rounded w-28" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          )}
          {!dashLoading && dashboard && dashboard.recent_expenses.length === 0 && (
            <p className="text-sm text-gray-400 py-4">No activity yet. Add expenses in a group to see them here.</p>
          )}
          {!dashLoading && dashboard && dashboard.recent_expenses.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
              {dashboard.recent_expenses.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => goToGroup(exp.group.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Avatar user={exp.paid_by} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{exp.description}</p>
                    <p className="text-xs text-gray-400">
                      {exp.group.name} · {exp.paid_by.id === user?.id ? 'you paid' : `${exp.paid_by.name} paid`}
                      {exp.my_share ? ` · your share $${parseFloat(exp.my_share).toFixed(2)}` : ''}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-700">${parseFloat(exp.amount).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{formatDate(exp.date)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Your groups (compact) */}
        <div>
          <SectionHeader
            title="Your groups"
            linkLabel="View all"
            onLink={() => navigate('/groups')}
          />
          {groupsLoading && (
            <div className="space-y-2">{[0, 1].map((i) => <SkeletonGroupCard key={i} />)}</div>
          )}
          {!groupsLoading && groups.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-8 text-center">
              <p className="text-sm text-gray-400 mb-3">No groups yet.</p>
              <button onClick={() => navigate('/groups')} className="text-sm text-violet-600 hover:underline font-medium">
                Create your first group →
              </button>
            </div>
          )}
          {!groupsLoading && groups.length > 0 && (
            <ul className="space-y-2">
              {groups.slice(0, 5).map((group: Group, i) => {
                const color = GROUP_COLORS[i % GROUP_COLORS.length]
                return (
                  <li key={group.id}>
                    <button
                      onClick={() => goToGroup(group.id)}
                      className={`w-full text-left ${color.bg} border ${color.border} rounded-2xl px-5 py-3 hover:shadow-sm transition-all`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{group.name}</p>
                          {group.description && <p className="text-xs text-gray-400 truncate mt-0.5">{group.description}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${color.badge}`}>
                            {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                          </span>
                          {group.is_settled && (
                            <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700">✓</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
              {groups.length > 5 && (
                <li>
                  <button onClick={() => navigate('/groups')} className="w-full text-sm text-violet-600 hover:underline font-medium py-2 text-left">
                    View all {groups.length} groups →
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
