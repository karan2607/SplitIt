import { useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, type GroupDetail, type Expense } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import Avatar from './Avatar'

const schema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Enter a valid amount'),
  paid_by: z.string().min(1, 'Select who paid'),
  split_among: z.array(z.string()),
  date: z.string().optional(),
})
type FormData = z.infer<typeof schema>

type SplitMode = 'equal' | 'percent' | 'amount'

interface CustomSplit {
  user_id: string
  percentage: string
}

interface AmountSplit {
  user_id: string
  amount: string
}

interface Props {
  group: GroupDetail
  onClose: () => void
  onCreated: (expense: Expense) => void
  initialExpense?: Expense
  onUpdated?: (expense: Expense) => void
}

export default function AddExpenseForm({ group, onClose, onCreated, initialExpense, onUpdated }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [splitMode, setSplitMode] = useState<SplitMode>('equal')
  const [customSplits, setCustomSplits] = useState<CustomSplit[]>(() =>
    group.members.map((m) => ({
      user_id: m.user.id,
      percentage: (100 / group.members.length).toFixed(2),
    }))
  )
  const [amountSplits, setAmountSplits] = useState<AmountSplit[]>(() =>
    group.members.map((m) => ({ user_id: m.user.id, amount: '' }))
  )
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEdit = !!initialExpense

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          description: initialExpense.description,
          amount: initialExpense.amount,
          paid_by: initialExpense.paid_by.id,
          split_among: initialExpense.splits.map((s) => s.user.id),
          date: initialExpense.date,
        }
      : {
          paid_by: '',
          split_among: group.members.map((m) => m.user.id),
          date: new Date().toISOString().split('T')[0],
        },
  })

  const splitAmong = watch('split_among')
  const amount = parseFloat(watch('amount') || '0')
  const perPerson = splitAmong.length > 0 && amount > 0
    ? (amount / splitAmong.length).toFixed(2)
    : null

  const customTotal = customSplits.reduce((sum, s) => sum + parseFloat(s.percentage || '0'), 0)
  const customTotalOk = Math.abs(customTotal - 100) < 0.01

  const amountTotal = amountSplits.reduce((sum, s) => sum + parseFloat(s.amount || '0'), 0)
  const amountRemaining = amount > 0 ? amount - amountTotal : 0
  const amountTotalOk = amount > 0 && Math.abs(amountTotal - amount) < 0.01

  function updateCustomPct(userId: string, value: string) {
    const raw = parseFloat(value) || 0
    const clamped = Math.min(100, Math.max(0, raw))
    const others = customSplits.filter((s) => s.user_id !== userId)
    const perOther = others.length > 0
      ? (Math.max(0, 100 - clamped) / others.length).toFixed(2)
      : '0'
    setCustomSplits((prev) =>
      prev.map((s) =>
        s.user_id === userId
          ? { ...s, percentage: clamped.toString() }
          : { ...s, percentage: perOther }
      )
    )
  }

  function updateAmountSplit(userId: string, value: string) {
    setAmountSplits((prev) =>
      prev.map((s) => (s.user_id === userId ? { ...s, amount: value } : s))
    )
  }

  async function handleScanReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError(null)
    setScanning(true)
    try {
      const result = await api.receipt.scan(file)
      if (result.amount) setValue('amount', result.amount)
      if (result.description) setValue('description', result.description)
    } catch (err) {
      setScanError(getErrorMessage(err))
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      let payload: Parameters<typeof api.expenses.create>[1]
      const totalAmt = parseFloat(data.amount)

      if (splitMode === 'percent') {
        if (!customTotalOk) {
          setServerError(`Percentages must sum to 100 (currently ${customTotal.toFixed(2)})`)
          return
        }
        payload = {
          description: data.description,
          amount: totalAmt.toFixed(2),
          paid_by: data.paid_by,
          splits: customSplits,
          date: data.date,
        }
      } else if (splitMode === 'amount') {
        if (!amountTotalOk) {
          setServerError(`Amounts must sum to $${totalAmt.toFixed(2)} (currently $${amountTotal.toFixed(2)})`)
          return
        }
        const splits = amountSplits
          .filter((s) => parseFloat(s.amount || '0') > 0)
          .map((s) => ({
            user_id: s.user_id,
            percentage: ((parseFloat(s.amount) / totalAmt) * 100).toFixed(4),
          }))
        payload = {
          description: data.description,
          amount: totalAmt.toFixed(2),
          paid_by: data.paid_by,
          splits,
          date: data.date,
        }
      } else {
        payload = {
          description: data.description,
          amount: totalAmt.toFixed(2),
          paid_by: data.paid_by,
          split_among: data.split_among,
          date: data.date,
        }
      }

      if (isEdit) {
        const updated = await api.expenses.update(group.id, initialExpense.id, payload)
        onUpdated?.(updated)
      } else {
        const expense = await api.expenses.create(group.id, payload)
        onCreated(expense)
      }
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  const splitInvalid =
    (splitMode === 'percent' && !customTotalOk) ||
    (splitMode === 'amount' && amount > 0 && !amountTotalOk)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit expense' : 'Add expense'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              {...register('description')}
              autoFocus
              placeholder="e.g. Dinner, Taxi, Groceries"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <div className="flex gap-2">
              <input
                {...register('amount')}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {scanning ? 'Scanning...' : 'Scan receipt'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleScanReceipt}
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            {scanError && <p className="text-xs text-red-500 mt-1">{scanError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
            <select
              {...register('paid_by')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              <option value="">Select a person</option>
              {group.members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
            {errors.paid_by && <p className="text-xs text-red-500 mt-1">{errors.paid_by.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Split
                {splitMode === 'equal' && perPerson && (
                  <span className="ml-2 text-xs font-normal text-violet-600">
                    ${perPerson} / person
                  </span>
                )}
              </label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                {(['equal', 'percent', 'amount'] as SplitMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                    className={`px-3 py-1 transition-colors ${splitMode === mode ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {mode === 'equal' ? 'Equal' : mode === 'percent' ? '%' : '$'}
                  </button>
                ))}
              </div>
            </div>

            {splitMode === 'equal' && (
              <Controller
                control={control}
                name="split_among"
                render={({ field }) => (
                  <div className="space-y-2">
                    {group.members.map((m) => {
                      const checked = field.value.includes(m.user.id)
                      return (
                        <label
                          key={m.user.id}
                          className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              field.onChange(
                                checked
                                  ? field.value.filter((id) => id !== m.user.id)
                                  : [...field.value, m.user.id]
                              )
                            }}
                            className="accent-violet-600"
                          />
                          <Avatar user={m.user} size="sm" />
                          <span className="text-sm text-gray-800">{m.user.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              />
            )}

            {splitMode === 'percent' && (
              <div className="space-y-2">
                {group.members.map((m) => {
                  const split = customSplits.find((s) => s.user_id === m.user.id)!
                  const pct = parseFloat(split.percentage || '0')
                  const dollarAmt = amount > 0 && pct > 0 ? ((amount * pct) / 100).toFixed(2) : null
                  return (
                    <div
                      key={m.user.id}
                      className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      <Avatar user={m.user} size="sm" />
                      <span className="flex-1 text-sm text-gray-800">{m.user.name}</span>
                      {dollarAmt && (
                        <span className="text-xs text-violet-600">${dollarAmt}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={split.percentage}
                          onChange={(e) => updateCustomPct(m.user.id, e.target.value)}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-500">%</span>
                      </div>
                    </div>
                  )
                })}
                <p className={`text-xs mt-1 ${customTotalOk ? 'text-gray-400' : 'text-red-500'}`}>
                  Total: {customTotal.toFixed(2)}% {customTotalOk ? '' : '(must equal 100%)'}
                </p>
              </div>
            )}

            {splitMode === 'amount' && (
              <div className="space-y-2">
                {group.members.map((m) => {
                  const split = amountSplits.find((s) => s.user_id === m.user.id)!
                  const val = parseFloat(split.amount || '0')
                  const pct = amount > 0 && val > 0 ? ((val / amount) * 100).toFixed(1) : null
                  return (
                    <div
                      key={m.user.id}
                      className="flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      <Avatar user={m.user} size="sm" />
                      <span className="flex-1 text-sm text-gray-800">{m.user.name}</span>
                      {pct && (
                        <span className="text-xs text-violet-600">{pct}%</span>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={split.amount}
                          onChange={(e) => updateAmountSplit(m.user.id, e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>
                  )
                })}
                <p className={`text-xs mt-1 ${amountTotalOk ? 'text-gray-400' : amountTotal > amount ? 'text-red-500' : 'text-amber-600'}`}>
                  {amountTotalOk
                    ? 'All allocated ✓'
                    : amountRemaining > 0
                      ? `$${amountRemaining.toFixed(2)} remaining`
                      : `Over by $${Math.abs(amountRemaining).toFixed(2)}`}
                  {amount === 0 && ' — enter a total amount above first'}
                </p>
              </div>
            )}

            {errors.split_among && splitMode === 'equal' && (
              <p className="text-xs text-red-500 mt-1">{errors.split_among.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              {...register('date')}
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || splitInvalid}
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
