import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGroup } from '../hooks/useGroup'
import { useAuth } from '../hooks/useAuth'
import { api, type Expense, type Balance, type GroupDetail } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import AddExpenseForm from '../components/AddExpenseForm'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { SkeletonExpenseCard } from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'

type Tab = 'expenses' | 'balances' | 'members' | 'activity'

const CARD_COLORS = [
  'bg-orange-50 border-orange-200',
  'bg-rose-50 border-rose-200',
  'bg-sky-50 border-sky-200',
  'bg-emerald-50 border-emerald-200',
  'bg-amber-50 border-amber-200',
  'bg-teal-50 border-teal-200',
  'bg-pink-50 border-pink-200',
  'bg-indigo-50 border-indigo-200',
]

const editGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(255).optional(),
})
type EditGroupFormData = z.infer<typeof editGroupSchema>

function EditGroupModal({
  group,
  onClose,
  onSaved,
}: {
  group: GroupDetail
  onClose: () => void
  onSaved: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditGroupFormData>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: { name: group.name, description: group.description ?? '' },
  })

  async function onSubmit(data: EditGroupFormData) {
    setServerError(null)
    try {
      await api.groups.update(group.id, {
        name: data.name,
        description: data.description || '',
      })
      onSaved()
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit group</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
            <input
              {...register('name')}
              autoFocus
              className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              {...register('description')}
              placeholder="What's this group for?"
              className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors">
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddMemberForm({ groupId, existingMemberIds, onAdded }: {
  groupId: string
  existingMemberIds: Set<string>
  onAdded: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<import('../lib/api').User[]>([])
  const [searching, setSearching] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (query.trim().length < 2) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        setResults(await api.users.search(query.trim()))
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  async function handleGenerateLink() {
    setGeneratingLink(true)
    try {
      const invite = await api.groups.generateLink(groupId)
      setInviteLink(invite.url ?? `${window.location.origin}/invite/${invite.token}`)
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setGeneratingLink(false)
    }
  }

  function handleCopyLink() {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      showToast('Link copied to clipboard', 'info')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleAdd(userId: string, name: string) {
    setPendingAdd(userId)
    setError(null)
    try {
      await api.groups.addMember(groupId, userId)
      showToast(`${name} added to group`)
      onAdded()
      setQuery('')
      setResults([])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPendingAdd(null)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 mb-4 shadow-sm space-y-4">
      {/* Invite link */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Share invite link</p>
        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={generatingLink}
          className="w-full border border-gray-300 bg-white text-violet-600 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {generatingLink ? 'Generating…' : '🔗 Generate invite link'}
        </button>
        {inviteLink && (
          <div className="flex items-center gap-2 mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-600 flex-1 truncate">{inviteLink}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="text-xs font-medium text-violet-600 hover:text-violet-800 whitespace-nowrap shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Direct add by search */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Or add directly</p>
        <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @username"
          className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
        )}
      </div>

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-xs text-gray-400 mt-2">No users found for "{query}"</p>
      )}

      {results.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <Avatar user={u} size="sm" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  {u.username && <p className="text-xs text-gray-400">@{u.username}</p>}
                </div>
              </div>
              {existingMemberIds.has(u.id) ? (
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">Already in group</span>
              ) : (
                <button
                  onClick={() => handleAdd(u.id, u.name)}
                  disabled={pendingAdd === u.id}
                  className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  {pendingAdd === u.id ? '…' : 'Add'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  )
}

function SettleModal({
  balance,
  groupId,
  onClose,
  onSettled,
}: {
  balance: Balance
  groupId: string
  onClose: () => void
  onSettled: (expense: Expense) => void
}) {
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)
    try {
      const expense = await api.balances.settle(groupId, {
        to_user_id: balance.to_user.id,
        amount: balance.amount,
        note: note.trim() || undefined,
      })
      onSettled(expense)
    } catch (err) {
      setError(getErrorMessage(err))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Settle up</h2>
        <p className="text-sm text-gray-500 mb-4">
          Pay <span className="font-medium text-gray-800">{balance.to_user.name}</span>{' '}
          <span className="font-semibold text-emerald-600">${balance.amount}</span>
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Venmo payment"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            {isSubmitting ? 'Recording...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity feed — derived from expenses + member joins, no extra API calls
// ---------------------------------------------------------------------------

type ActivityItem =
  | { kind: 'expense'; id: string; actor: import('../lib/api').User; label: string; sub: string; date: string; isSettlement: boolean }
  | { kind: 'join'; id: string; actor: import('../lib/api').GroupMember['user']; label: string; date: string }

function ActivityFeed({
  expenses,
  members,
  isLoading,
}: {
  expenses: import('../lib/api').Expense[]
  members: import('../lib/api').GroupMember[]
  isLoading: boolean
}) {
  const items: ActivityItem[] = [
    ...expenses.map((e): ActivityItem => {
      const otherPerson = e.is_settlement && e.splits[0]
        ? ` → ${e.splits[0].user.name}`
        : ''
      return {
        kind: 'expense',
        id: e.id,
        actor: e.created_by,
        label: e.is_settlement
          ? `Settled $${e.amount}${otherPerson}`
          : `Added "${e.description}" — $${e.amount}`,
        sub: e.is_settlement ? 'Settlement' : `Paid by ${e.paid_by.name}`,
        date: e.created_at,
        isSettlement: e.is_settlement,
      }
    }),
    ...members.map((m): ActivityItem => ({
      kind: 'join',
      id: m.id,
      actor: m.user,
      label: 'Joined the group',
      date: m.joined_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3.5 w-48 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
        <p className="text-gray-500">No activity yet</p>
      </div>
    )
  }

  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
          <div className="shrink-0 mt-0.5">
            <Avatar user={item.actor} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{item.actor.name}</span>
              {' '}
              <span className={item.kind === 'join' ? 'text-gray-500' : item.isSettlement ? 'text-emerald-700' : 'text-gray-700'}>
                {item.label}
              </span>
            </p>
            {'sub' in item && (
              <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {new Date(item.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
          {item.kind === 'join' && (
            <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5 self-start mt-0.5 shrink-0">
              joined
            </span>
          )}
          {item.kind === 'expense' && item.isSettlement && (
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 self-start mt-0.5 shrink-0">
              settled
            </span>
          )}
          {item.kind === 'expense' && !item.isSettlement && (
            <span className={`text-xs rounded-full px-2 py-0.5 self-start mt-0.5 shrink-0 ${CARD_COLORS[i % CARD_COLORS.length].replace('bg-', 'bg-').split(' ')[0]} text-gray-600 border ${CARD_COLORS[i % CARD_COLORS.length].split(' ')[1]}`}>
              expense
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { group, isLoading, error, refetch } = useGroup(id!)
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showEditGroup, setShowEditGroup] = useState(false)
  const [balances, setBalances] = useState<Balance[]>([])
  const [balancesLoading, setBalancesLoading] = useState(true)
  const [balancesLoaded, setBalancesLoaded] = useState(false)
  const [settlingBalance, setSettlingBalance] = useState<Balance | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)

  useEffect(() => {
    if (!id) return
    setExpensesLoading(true)
    api.expenses.list(id)
      .then(setExpenses)
      .finally(() => setExpensesLoading(false))
  }, [id])

  // Load balances on mount so the summary bar is correct immediately
  useEffect(() => {
    if (!id) return
    api.balances.list(id)
      .then((res) => { setBalances(res.balances); setBalancesLoaded(true) })
      .finally(() => setBalancesLoading(false))
  }, [id])

  function refreshBalances() {
    if (!id) return
    api.balances.list(id).then((res) => { setBalances(res.balances); setBalancesLoaded(true) })
  }

  function handleExpenseCreated(expense: Expense) {
    setExpenses((prev) => [expense, ...prev])
    setShowAddExpense(false)
    showToast('Expense added')
    refreshBalances()
  }

  function handleExpenseUpdated(updated: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingExpense(null)
    showToast('Expense updated')
    refreshBalances()
  }

  function handleSettled(expense: Expense) {
    setExpenses((prev) => [expense, ...prev])
    setSettlingBalance(null)
    showToast('Settlement recorded', 'success')
    if (id) {
      api.balances.list(id).then((res) => setBalances(res.balances))
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    await api.expenses.delete(id!, expenseId)
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
    showToast('Expense deleted', 'info')
    refreshBalances()
  }

  const isAdmin = group?.members.some((m) => m.user.id === user?.id && m.role === 'admin') ?? false

  // Summary bar computations
  const nonSettlements = expenses.filter((e) => !e.is_settlement)
  const totalSpent = nonSettlements.reduce((sum, e) => sum + parseFloat(e.amount), 0)
  const yourNetBalance = balances.reduce((net, b) => {
    if (b.from_user.id === user?.id) return net - parseFloat(b.amount)
    if (b.to_user.id === user?.id) return net + parseFloat(b.amount)
    return net
  }, 0)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <header className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-4 flex items-center gap-4 shadow-md">
          <button onClick={() => navigate('/dashboard')} className="text-white/60 hover:text-white transition-colors text-lg leading-none" aria-label="Back">←</button>
          <div className="h-6 w-32 bg-white/20 rounded animate-pulse" />
        </header>
        <main className="max-w-3xl mx-auto px-6 py-8 space-y-3">
          {[0, 1, 2, 3].map((i) => <SkeletonExpenseCard key={i} />)}
        </main>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error ?? 'Group not found'}</p>
          <Link to="/dashboard" className="text-violet-600 hover:underline text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-violet-50">
      <header className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-4 flex items-center gap-4 shadow-md">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-white/60 hover:text-white transition-colors text-lg leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{group.name}</h1>
            {group.description && (
              <p className="text-sm text-white/60 truncate">{group.description}</p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowEditGroup(true)}
              className="text-white/50 hover:text-white transition-colors flex-shrink-0 text-base leading-none mt-0.5"
              aria-label="Edit group"
            >
              ✎
            </button>
          )}
        </div>
      </header>

      {/* Summary bar */}
      {!expensesLoading && (
        <div className="bg-violet-600 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-violet-200 uppercase tracking-wide">Total spent</p>
              <p className="text-lg font-bold text-white">${totalSpent.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-violet-200 uppercase tracking-wide">Expenses</p>
              <p className="text-lg font-bold text-white">{nonSettlements.length}</p>
            </div>
            {balancesLoaded && yourNetBalance !== 0 && (
              <div className="ml-auto">
                <p className="text-xs text-violet-200 uppercase tracking-wide">Your balance</p>
                <p className={`text-lg font-bold ${yourNetBalance > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {yourNetBalance > 0 ? `+$${yourNetBalance.toFixed(2)} owed to you` : `-$${Math.abs(yourNetBalance).toFixed(2)} you owe`}
                </p>
              </div>
            )}
            {balancesLoaded && yourNetBalance === 0 && nonSettlements.length > 0 && (
              <div className="ml-auto">
                <span className="text-xs font-medium text-emerald-400 border border-emerald-600 rounded-full px-2.5 py-1">
                  All settled up ✓
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-violet-500 px-6">
        <nav className="flex gap-6 max-w-3xl mx-auto">
          {(['expenses', 'balances', 'members', 'activity'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-amber-400 text-white'
                  : 'border-transparent text-violet-200 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {activeTab === 'expenses' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAddExpense(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Add expense
              </button>
            </div>

            {expensesLoading && (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => <SkeletonExpenseCard key={i} />)}
              </div>
            )}

            {!expensesLoading && expenses.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-500 mb-2">No expenses yet</p>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="text-violet-600 hover:underline text-sm font-medium"
                >
                  Add the first expense
                </button>
              </div>
            )}

            {!expensesLoading && expenses.length > 0 && (
              <ul className="space-y-3">
                {expenses.map((expense, i) => (
                  <li
                    key={expense.id}
                    className={`rounded-2xl shadow-sm border ${
                      expense.is_settlement
                        ? 'border-l-4 border-l-emerald-400 bg-emerald-50 border-emerald-200'
                        : CARD_COLORS[i % CARD_COLORS.length]
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Avatar user={expense.paid_by} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-gray-900 truncate">{expense.description}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {expense.is_settlement && (
                              <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">
                                Settlement
                              </span>
                            )}
                            <p className="text-base font-bold text-violet-600">
                              ${expense.amount}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-gray-500">
                            Paid by <span className="font-medium text-gray-700">{expense.paid_by.name}</span>
                            {' · '}
                            {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {!expense.is_settlement && expense.splits.length > 0 && (
                              <span className="text-gray-400">
                                {' · '}{expense.splits.length} {expense.splits.length === 1 ? 'person' : 'people'}
                                {' · '}${(parseFloat(expense.amount) / expense.splits.length).toFixed(2)} ea
                              </span>
                            )}
                          </p>
                          {(() => {
                            const canAct = expense.created_by.id === user?.id || expense.paid_by.id === user?.id || isAdmin
                            const disabledReason = 'Only the creator, payer, or a group admin can do this'
                            return (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setEditingExpense(expense)}
                                  disabled={!canAct}
                                  title={canAct ? 'Edit expense' : disabledReason}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => setDeletingExpense(expense)}
                                  disabled={!canAct}
                                  title={canAct ? 'Delete expense' : disabledReason}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none"
                                >
                                  ×
                                </button>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'balances' && (
          <div>
            {balancesLoading && (
              <div className="space-y-3">
                {[0, 1].map((i) => <SkeletonExpenseCard key={i} />)}
              </div>
            )}

            {!balancesLoading && balances.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-emerald-600 font-semibold mb-1">All settled up!</p>
                <p className="text-sm text-gray-400">No outstanding balances in this group.</p>
              </div>
            )}

            {!balancesLoading && balances.length > 0 && (
              <ul className="space-y-3">
                {balances.map((b, i) => (
                  <li key={i} className={`${CARD_COLORS[i % CARD_COLORS.length]} rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm border`}>
                    <div className="flex items-center gap-3">
                      <Avatar user={b.from_user} size="sm" />
                      <div>
                        <p className="text-sm text-gray-800">
                          <span className="font-medium">{b.from_user.name}</span>
                          <span className="text-gray-400 mx-2">owes</span>
                          <span className="font-medium">{b.to_user.name}</span>
                        </p>
                        <p className={`text-lg font-bold mt-0.5 ${b.from_user.id === user?.id ? 'text-rose-600' : 'text-gray-700'}`}>
                          ${b.amount}
                        </p>
                      </div>
                    </div>
                    {b.from_user.id === user?.id && (
                      <button
                        onClick={() => setSettlingBalance(b)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Settle up
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div>
            <AddMemberForm
              groupId={id!}
              existingMemberIds={new Set(group.members.map((m) => m.user.id))}
              onAdded={refetch}
            />
            <ul className="space-y-3">
              {group.members.map((member, i) => (
                <li
                  key={member.id}
                  className={`${CARD_COLORS[i % CARD_COLORS.length]} border rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar user={member.user} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {member.user.name}
                        {member.user.id === user?.id && (
                          <span className="text-gray-400 font-normal"> (you)</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{member.user.email}</p>
                    </div>
                  </div>
                  {member.role === 'admin' && (
                    <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                      admin
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'activity' && (
          <ActivityFeed expenses={expenses} members={group.members} isLoading={expensesLoading} />
        )}
      </main>

      {showAddExpense && group && (
        <AddExpenseForm
          group={group}
          onClose={() => setShowAddExpense(false)}
          onCreated={handleExpenseCreated}
        />
      )}

      {editingExpense && group && (
        <AddExpenseForm
          group={group}
          onClose={() => setEditingExpense(null)}
          onCreated={handleExpenseCreated}
          initialExpense={editingExpense}
          onUpdated={handleExpenseUpdated}
        />
      )}

      {settlingBalance && id && (
        <SettleModal
          balance={settlingBalance}
          groupId={id}
          onClose={() => setSettlingBalance(null)}
          onSettled={handleSettled}
        />
      )}

      {showEditGroup && group && (
        <EditGroupModal
          group={group}
          onClose={() => setShowEditGroup(false)}
          onSaved={() => {
            refetch()
            setShowEditGroup(false)
            showToast('Group updated')
          }}
        />
      )}

      {deletingExpense && (
        <ConfirmModal
          title="Delete expense?"
          message={`"${deletingExpense.description}" will be permanently deleted.`}
          onConfirm={async () => {
            await handleDeleteExpense(deletingExpense.id)
            setDeletingExpense(null)
          }}
          onClose={() => setDeletingExpense(null)}
        />
      )}
    </div>
  )
}
