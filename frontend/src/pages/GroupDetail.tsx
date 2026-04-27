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

type Tab = 'expenses' | 'balances' | 'members'

const inviteSchema = z.object({
  emails: z.string().min(1, 'Enter at least one email address'),
})
type InviteFormData = z.infer<typeof inviteSchema>

function InviteForm({ groupId, onSuccess }: { groupId: string; onSuccess: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  })

  async function onSubmit(data: InviteFormData) {
    setServerError(null)
    setSuccessCount(null)
    const emails = data.emails.split(/[\s,]+/).map(e => e.trim()).filter(Boolean)
    try {
      const result = await api.groups.invite(groupId, emails)
      setSuccessCount(result.length)
      reset()
      onSuccess()
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-4">
      <p className="text-sm font-medium text-gray-700 mb-2">Invite people</p>
      <div className="flex gap-2">
        <input
          {...register('emails')}
          type="text"
          placeholder="email@example.com, another@example.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          {isSubmitting ? 'Sending...' : 'Send invite'}
        </button>
      </div>
      {errors.emails && <p className="text-xs text-red-500 mt-1">{errors.emails.message}</p>}
      {serverError && <p className="text-xs text-red-500 mt-1">{serverError}</p>}
      {successCount !== null && (
        <p className="text-xs text-green-600 mt-1">
          {successCount === 0 ? 'No new invites sent (already members?)' : `${successCount} invite${successCount > 1 ? 's' : ''} sent!`}
        </p>
      )}
    </form>
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
          <span className="font-semibold text-gray-900">${balance.amount}</span>
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Venmo payment"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
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
  const [activeTab, setActiveTab] = useState<Tab>('expenses')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [balances, setBalances] = useState<Balance[]>([])
  const [balancesLoading, setBalancesLoading] = useState(false)
  const [settlingBalance, setSettlingBalance] = useState<Balance | null>(null)

  useEffect(() => {
    if (!id) return
    setExpensesLoading(true)
    api.expenses.list(id)
      .then(setExpenses)
      .finally(() => setExpensesLoading(false))
  }, [id])

  useEffect(() => {
    if (!id || activeTab !== 'balances') return
    setBalancesLoading(true)
    api.balances.list(id)
      .then((res) => setBalances(res.balances))
      .finally(() => setBalancesLoading(false))
  }, [id, activeTab])

  function handleExpenseCreated(expense: Expense) {
    setExpenses((prev) => [expense, ...prev])
    setShowAddExpense(false)
  }

  function handleExpenseUpdated(updated: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingExpense(null)
  }

  function handleSettled(expense: Expense) {
    setExpenses((prev) => [expense, ...prev])
    setSettlingBalance(null)
    // Refresh balances after settlement
    if (id) {
      api.balances.list(id).then((res) => setBalances(res.balances))
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    await api.expenses.delete(id!, expenseId)
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Loading...
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error ?? 'Group not found'}</p>
          <Link to="/dashboard" className="text-indigo-600 hover:underline text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-gray-500">{group.description}</p>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex gap-6">
          {(['expenses', 'balances', 'members'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                + Add expense
              </button>
            </div>

            {expensesLoading && (
              <p className="text-sm text-gray-400 text-center py-12">Loading...</p>
            )}

            {!expensesLoading && expenses.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-500 mb-2">No expenses yet</p>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="text-indigo-600 hover:underline text-sm font-medium"
                >
                  Add the first expense
                </button>
              </div>
            )}

            {!expensesLoading && expenses.length > 0 && (
              <ul className="space-y-3">
                {expenses.map((expense) => (
                  <li key={expense.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                          <p className="text-base font-semibold text-gray-900 ml-4 shrink-0">
                            ${expense.amount}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500">
                          Paid by <span className="font-medium text-gray-700">{expense.paid_by.name}</span>
                          {' · '}
                          {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {expense.splits.map((split) => (
                            <span
                              key={split.id}
                              className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5"
                            >
                              {split.user.name} ${split.amount_owed}
                            </span>
                          ))}
                        </div>
                      </div>

                      {expense.created_by.id === user?.id && (
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                          <button
                            onClick={() => setEditingExpense(expense)}
                            className="text-gray-300 hover:text-indigo-500 transition-colors text-sm leading-none"
                            aria-label="Edit expense"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                            aria-label="Delete expense"
                          >
                            ×
                          </button>
                        </div>
                      )}
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
              <p className="text-sm text-gray-400 text-center py-12">Loading...</p>
            )}

            {!balancesLoading && balances.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-500 mb-1">All settled up!</p>
                <p className="text-sm text-gray-400">No outstanding balances in this group.</p>
              </div>
            )}

            {!balancesLoading && balances.length > 0 && (
              <ul className="space-y-3">
                {balances.map((b, i) => (
                  <li key={i} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">{b.from_user.name}</span>
                        <span className="text-gray-400 mx-2">owes</span>
                        <span className="font-medium">{b.to_user.name}</span>
                      </p>
                      <p className="text-lg font-semibold text-gray-900 mt-0.5">${b.amount}</p>
                    </div>
                    {b.from_user.id === user?.id && (
                      <button
                        onClick={() => setSettlingBalance(b)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
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
                  className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.user.name}
                      {member.user.id === user?.id && (
                        <span className="text-gray-400 font-normal"> (you)</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                  </div>
                  {member.role === 'admin' && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
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
