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

interface CustomSplit {
  user_id: string
  percentage: string
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
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [customSplits, setCustomSplits] = useState<CustomSplit[]>(() =>
    group.members.map((m) => ({
      user_id: m.user.id,
      percentage: (100 / group.members.length).toFixed(2),
    }))
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

  function updateCustomPct(userId: string, value: string) {
    const newPct = parseFloat(value) || 0
    const others = customSplits.filter((s) => s.user_id !== userId)
    const perOther = others.length > 0
      ? (Math.max(0, 100 - newPct) / others.length).toFixed(2)
      : '0'
    setCustomSplits((prev) =>
      prev.map((s) =>
        s.user_id === userId ? { ...s, percentage: value } : { ...s, percentage: perOther }
      )
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
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      let payload: Parameters<typeof api.expenses.create>[1]

      if (splitMode === 'custom') {
        if (!customTotalOk) {
          setServerError(`Percentages must sum to 100 (currently ${customTotal.toFixed(2)})`)
          return
        }
        payload = {
          description: data.description,
          amount: parseFloat(data.amount).toFixed(2),
          paid_by: data.paid_by,
          splits: customSplits,
          date: data.date,
        }
      } else {
        payload = {
          description: data.description,
          amount: parseFloat(data.amount).toFixed(2),
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
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`px-3 py-1 transition-colors ${splitMode === 'equal' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Equal
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('custom')}
                  className={`px-3 py-1 transition-colors ${splitMode === 'custom' ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Custom %
                </button>
              </div>
            </div>

            {splitMode === 'equal' ? (
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
            ) : (
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
              disabled={isSubmitting || (splitMode === 'custom' && !customTotalOk)}
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
