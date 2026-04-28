import { useState } from 'react'
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

const schema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(255).optional(),
})
type FormData = z.infer<typeof schema>

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
              className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors"
            >
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
  const { showToast } = useToast()

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

  return (
    <div className="min-h-screen bg-violet-50">
      <header className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-4 flex items-center justify-between shadow-md">
        <h1 className="text-xl font-bold text-white tracking-tight">SplitIt</h1>
        <div className="flex items-center gap-3">
          <Link to="/profile" className="flex items-center gap-2 group">
            {user && <Avatar user={user} size="sm" className="ring-2 ring-white/30 group-hover:ring-white/60 transition-all" />}
            <span className="text-sm text-white/80 group-hover:text-white transition-colors hidden sm:block">
              {user?.name}
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-white/60 hover:text-white transition-colors ml-1"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Your groups</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New group
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <SkeletonGroupCard key={i} />)}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center py-12">{error}</p>
        )}

        {!isLoading && !error && groups.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-500 mb-3">No groups yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-violet-600 hover:underline text-sm font-medium"
            >
              Create your first group
            </button>
          </div>
        )}

        {!isLoading && groups.length > 0 && (
          <ul className="space-y-3">
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="w-full text-left bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:border-violet-200 hover:shadow-md transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      {group.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
                      {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showModal && (
        <CreateGroupModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
