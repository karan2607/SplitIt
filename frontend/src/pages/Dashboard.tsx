import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroup'
import { api, type Group } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'
import { SkeletonGroupCard } from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'

const schema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(255).optional(),
})
type FormData = z.infer<typeof schema>

const GROUP_COLORS = [
  { bg: 'bg-orange-50', border: 'border-orange-200', hover: 'hover:border-orange-400', badge: 'bg-orange-100 text-orange-700' },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   hover: 'hover:border-rose-400',   badge: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-sky-50',    border: 'border-sky-200',    hover: 'hover:border-sky-400',    badge: 'bg-sky-100 text-sky-700' },
  { bg: 'bg-emerald-50',border: 'border-emerald-200',hover: 'hover:border-emerald-400',badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-amber-50',  border: 'border-amber-200',  hover: 'hover:border-amber-400',  badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-teal-50',   border: 'border-teal-200',   hover: 'hover:border-teal-400',   badge: 'bg-teal-100 text-teal-700' },
  { bg: 'bg-pink-50',   border: 'border-pink-200',   hover: 'hover:border-pink-400',   badge: 'bg-pink-100 text-pink-700' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', hover: 'hover:border-indigo-400', badge: 'bg-indigo-100 text-indigo-700' },
]

const HOW_IT_WORKS = [
  {
    icon: '👥',
    title: 'Create a group',
    desc: 'Barcelona trip, apartment bills, dinner with friends — any shared expense.',
  },
  {
    icon: '🧾',
    title: 'Add expenses',
    desc: 'Log who paid what. Split equally or set custom percentages per person.',
  },
  {
    icon: '💸',
    title: 'Settle up',
    desc: "See exactly who owes who and record payments when you're square.",
  },
]

const editGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(255).optional(),
})
type EditGroupFormData = z.infer<typeof editGroupSchema>

function EditGroupModal({ group, onClose, onSaved }: { group: Group; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditGroupFormData>({
    resolver: zodResolver(editGroupSchema),
    defaultValues: { name: group.name, description: group.description ?? '' },
  })

  async function onSubmit(data: EditGroupFormData) {
    setServerError(null)
    try {
      await api.groups.update(group.id, { name: data.name, description: data.description || '' })
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
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
            <input {...register('name')} autoFocus className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input {...register('description')} placeholder="What's this group for?" className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors">
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: Group) => void }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const group = await api.groups.create(data)
      onCreated(group)
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Group</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
            <input
              {...register('name')}
              autoFocus
              placeholder="e.g. Barcelona Trip"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors">
              {isSubmitting ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { groups, isLoading, error, refetch } = useGroups()
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const [pendingFriendCount, setPendingFriendCount] = useState(0)
  const { showToast } = useToast()

  useEffect(() => {
    if (!user) return
    api.friends.list().then((list) => {
      const count = list.filter(
        (f) => f.status === 'pending' && f.to_user.id === user.id
      ).length
      setPendingFriendCount(count)
    }).catch(() => {})
  }, [user])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function handleCreated(group: Group) {
    setShowModal(false)
    refetch()
    showToast(`Group "${group.name}" created`)
    navigate(`/groups/${group.id}`)
  }

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-xl font-bold text-white tracking-tight">SplitIt</h1>
        <div className="flex items-center gap-3">
          <Link to="/friends" className="relative text-sm text-white/70 hover:text-white transition-colors flex items-center gap-1">
            Friends
            {pendingFriendCount > 0 && (
              <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold rounded-full px-1">
                {pendingFriendCount}
              </span>
            )}
          </Link>
          <Link to="/profile" className="flex items-center gap-2 group">
            {user && <Avatar user={user} size="sm" className="ring-2 ring-white/30 group-hover:ring-white/60 transition-all" />}
            <span className="text-sm text-white/80 group-hover:text-white transition-colors hidden sm:block">
              {user?.name}
            </span>
          </Link>
          <button onClick={handleLogout} className="text-sm text-white/60 hover:text-white transition-colors ml-1">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName}! 👋
          </h2>
          <p className="text-gray-500 mt-1">
            {isLoading
              ? 'Loading your groups…'
              : groups.length > 0
                ? `You're in ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}. Track expenses and settle up easily.`
                : 'Create your first group to start splitting expenses with friends.'}
          </p>
        </div>

        {/* How it works — shown only when no groups */}
        {!isLoading && !error && groups.length === 0 && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-5">How SplitIt works</h3>
            <div className="space-y-5">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-violet-600/10 flex items-center justify-center text-xl flex-shrink-0">
                    {step.icon}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl py-2.5 text-sm transition-colors"
            >
              Create your first group →
            </button>
          </div>
        )}

        {/* Groups section */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            {groups.length > 0 ? 'Your groups' : ''}
          </h3>
          {groups.length > 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New group
            </button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <SkeletonGroupCard key={i} />)}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center py-12">{error}</p>
        )}

        {!isLoading && groups.length > 0 && (
          <ul className="space-y-3">
            {groups.map((group, i) => {
              const color = GROUP_COLORS[i % GROUP_COLORS.length]
              return (
                <li key={group.id} className="relative group/card">
                  <div className={`${color.bg} border ${color.border} rounded-2xl shadow-sm hover:shadow-md transition-all`}>
                    <button
                      onClick={() => navigate(`/groups/${group.id}`)}
                      className="w-full text-left px-5 py-4 pr-20"
                    >
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      {group.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${color.badge}`}>
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </span>
                        {group.is_settled && (
                          <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700">
                            ✓ Settled up
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingGroup(group)}
                      className="p-1.5 rounded-lg hover:bg-black/10 text-gray-400 hover:text-violet-600 transition-colors"
                      aria-label="Edit group"
                    >✎</button>
                    <button
                      onClick={() => setDeletingGroup(group)}
                      className="p-1.5 rounded-lg hover:bg-black/10 text-gray-400 hover:text-rose-500 transition-colors text-lg leading-none"
                      aria-label="Delete group"
                    >×</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {showModal && (
        <CreateGroupModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSaved={() => {
            refetch()
            setEditingGroup(null)
            showToast('Group updated')
          }}
        />
      )}

      {deletingGroup && (
        <ConfirmModal
          title="Delete group?"
          message={`"${deletingGroup.name}" and all its expenses will be permanently deleted. This cannot be undone.`}
          onConfirm={async () => {
            await api.groups.delete(deletingGroup.id)
            setDeletingGroup(null)
            refetch()
            showToast('Group deleted', 'info')
          }}
          onClose={() => setDeletingGroup(null)}
        />
      )}
    </div>
  )
}
