import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { api, type GroupDetail, type Expense } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

const schema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Enter a valid amount'),
  paid_by: z.string().min(1, 'Select who paid'),
  split_among: z.array(z.string()).min(1, 'Select at least one person'),
  date: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  group: GroupDetail
  onClose: () => void
  onCreated: (expense: Expense) => void
  /** When provided the form operates in edit mode */
  initialExpense?: Expense
  onUpdated?: (expense: Expense) => void
}

export default function AddExpenseForm({ group, onClose, onCreated, initialExpense, onUpdated }: Props) {
  const [serverError, setServerError] = useState<string | null>(null)
  const isEdit = !!initialExpense

  const {
    register,
    handleSubmit,
    control,
    watch,
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

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      if (isEdit) {
        const updated = await api.expenses.update(group.id, initialExpense.id, {
          ...data,
          amount: parseFloat(data.amount).toFixed(2),
        })
        onUpdated?.(updated)
      } else {
        const expense = await api.expenses.create(group.id, {
          ...data,
          amount: parseFloat(data.amount).toFixed(2),
        })
        onCreated(expense)
      }
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isEdit ? 'Edit expense' : 'Add expense'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              {...register('description')}
              autoFocus
              placeholder="e.g. Dinner, Taxi, Groceries"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
            <input
              {...register('amount')}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by</label>
            <select
              {...register('paid_by')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select a person</option>
              {group.members.map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.name}</option>
              ))}
            </select>
            {errors.paid_by && <p className="text-xs text-red-500 mt-1">{errors.paid_by.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Split among
              {perPerson && (
                <span className="ml-2 text-xs font-normal text-indigo-600">
                  ${perPerson} / person
                </span>
              )}
            </label>
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
                          className="accent-indigo-600"
                        />
                        <span className="text-sm text-gray-800">{m.user.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            />
            {errors.split_among && <p className="text-xs text-red-500 mt-1">{errors.split_among.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              {...register('date')}
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
