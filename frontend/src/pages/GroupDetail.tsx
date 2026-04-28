import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useGroup } from '../hooks/useGroup'
import { useAuth } from '../hooks/useAuth'
import { api, type Expense, type Balance } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import AddExpenseForm from '../components/AddExpenseForm'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { SkeletonExpenseCard } from '../components/Skeleton'

type Tab = 'expenses' | 'balances' | 'members'

const inviteSchema = z.object({
  emails: z.string().min(1, 'Enter at least one email address'),
})
type InviteFormData = z.infer<typeof inviteSchema>

function CopyLinkRow({ url, onCopied }: { url: string; onCopied: () => void }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      onCopied()
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-2 mt-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
      <span className="text-xs text-gray-600 flex-1 truncate">{url}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-xs font-medium text-violet-600 hover:text-violet-800 whitespace-nowrap shrink-0"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function InviteForm({ groupId, onSuccess }: { groupId: string; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const { showToast } = useToast()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  })

  async function onSubmit(data: InviteFormData) {
    setServerError(null)
    const emails = data.emails.split(/[\s,]+/).map(e => e.trim()).filter(Boolean)
    try {
      await api.groups.invite(groupId, emails)
      reset()
      showToast('Invite sent!')
      onSuccess()
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  async function handleGenerateLink() {
    setIsGenerating(true)
    setServerError(null)
    try {
      const invite = await api.groups.generateLink(groupId)
      setGeneratedLink(invite.url ?? `${window.location.origin}/invite/${invite.token}`)
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 mb-4 space-y-3 shadow-sm">
      <p className="text-sm font-medium text-gray-700">Invite people</p>

      <div>
        <button
          type="button"
          onClick={handleGenerateLink}
          disabled={isGenerating}
          className="w-full border border-violet-300 text-violet-600 hover:bg-violet-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {isGenerating ? 'Generating...' : '🔗 Generate invite link'}
        </button>
        {generatedLink && (
          <CopyLinkRow
            url={generatedLink}
            onCopied={() => showToast('Link copied to clipboard', 'info')}
          />
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className="text-xs text-gray-500 mb-1">Or invite by email</p>
        <div className="flex gap-2">
          <input
            {...register('emails')}
            type="text"
            placeholder="email@example.com, another@example.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </div>
        {errors.emails && <p className="text-xs text-red-500 mt-1">{errors.emails.message}</p>}
      </form>

      {serverError && <p className="text-xs text-red-500">{serverError}</p>}
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
  const [balances, setBalances] = useState<Balance[]>([])
  const [balancesLoading, setBalancesLoading] = useState(true)
  const [balancesLoaded, setBalancesLoaded] = useState(false)
  const [settlingBalance, setSettlingBalance] = useState<Balance | null>(null)

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

  function handleExpenseCreated(expense: Expense) {
    setExpenses((prev) => [expense, ...prev])
    setShowAddExpense(false)
    showToast('Expense added')
  }

  function handleExpenseUpdated(updated: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingExpense(null)
    showToast('Expense updated')
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
  }

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
      <div className="min-h-screen bg-violet-50">
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
        <div>
          <h1 className="text-xl font-bold text-white">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-white/60">{group.description}</p>
          )}
        </div>
      </header>

      {/* Summary bar */}
      {!expensesLoading && (
        <div className="bg-violet-50 border-b border-violet-100 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total spent</p>
              <p className="text-lg font-bold text-gray-900">${totalSpent.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Expenses</p>
              <p className="text-lg font-bold text-gray-900">{nonSettlements.length}</p>
            </div>
            {balancesLoaded && yourNetBalance !== 0 && (
              <div className="ml-auto">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Your balance</p>
                <p className={`text-lg font-bold ${yourNetBalance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {yourNetBalance > 0 ? `+$${yourNetBalance.toFixed(2)} owed to you` : `-$${Math.abs(yourNetBalance).toFixed(2)} you owe`}
                </p>
              </div>
            )}
            {balancesLoaded && yourNetBalance === 0 && nonSettlements.length > 0 && (
              <div className="ml-auto">
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  All settled up ✓
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-violet-50 border-b border-violet-100 px-6">
        <nav className="flex gap-6 max-w-3xl mx-auto">
          {(['expenses', 'balances', 'members'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
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
                {expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className={`bg-white rounded-2xl shadow-sm border group ${
                      expense.is_settlement
                        ? 'border-l-4 border-l-emerald-400 border-gray-100'
                        : 'border-gray-100'
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
                          {expense.created_by.id === user?.id && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingExpense(expense)}
                                className="text-gray-400 hover:text-violet-500 transition-colors text-sm leading-none"
                                aria-label="Edit expense"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="text-gray-400 hover:text-rose-500 transition-colors text-lg leading-none"
                                aria-label="Delete expense"
                              >
                                ×
                              </button>
                            </div>
                          )}
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
                  <li key={i} className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
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
            <InviteForm groupId={id!} onSuccess={refetch} />
            <ul className="space-y-3">
              {group.members.map((member) => (
                <li
                  key={member.id}
                  className="bg-white border border-gray-100 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm"
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
    </div>
  )
}
