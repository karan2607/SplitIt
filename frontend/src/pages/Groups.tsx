import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { useGroups } from '../hooks/useGroup'
import { api, type Group, type User } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useToast } from '../components/Toast'
import { SkeletonGroupCard } from '../components/Skeleton'
import ConfirmModal from '../components/ConfirmModal'
import Avatar from '../components/Avatar'
import PageHeader from '../components/PageHeader'

const schema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(255).optional(),
})
type FormData = z.infer<typeof schema>

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

const HOW_IT_WORKS = [
  { icon: '👥', title: 'Create a group', desc: 'Barcelona trip, apartment bills, dinner with friends — any shared expense.' },
  { icon: '🧾', title: 'Add expenses', desc: 'Log who paid what. Split equally or set custom percentages per person.' },
  { icon: '💸', title: 'Settle up', desc: "See exactly who owes who and record payments when you're square." },
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
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<User[]>([])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (memberQuery.trim().length < 2) { setMemberResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await api.users.search(memberQuery.trim())
        const selectedIds = new Set(selectedMembers.map((m) => m.id))
        setMemberResults(results.filter((u) => u.id !== user?.id && !selectedIds.has(u.id)))
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [memberQuery, selectedMembers, user])

  function addMember(u: User) {
    setSelectedMembers((prev) => [...prev, u])
    setMemberQuery('')
    setMemberResults([])
  }

  function removeMember(id: string) {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
  }

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      const group = await api.groups.create(data)
      await Promise.all(selectedMembers.map((m) => api.groups.addMember(group.id, m.id)))
      onCreated(group)
    } catch (err) {
      setServerError(getErrorMessage(err))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Group</h2>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
            <input {...register('name')} autoFocus placeholder="e.g. Barcelona Trip" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input {...register('description')} placeholder="What's this group for?" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Add members <span className="text-gray-400 font-normal">(optional)</span></label>
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedMembers.map((m) => (
                  <span key={m.id} className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium rounded-full pl-2 pr-1 py-1">
                    {m.name}
                    <button type="button" onClick={() => removeMember(m.id)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-violet-200 transition-colors text-violet-500 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input type="text" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Search by name or @username" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>}
            </div>
            {memberResults.length > 0 && (
              <ul className="mt-1.5 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {memberResults.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Avatar user={u} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        {u.username && <p className="text-xs text-gray-400">@{u.username}</p>}
                      </div>
                    </div>
                    <button type="button" onClick={() => addMember(u)} className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-medium px-2.5 py-1 rounded-lg transition-colors">Add</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {serverError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{serverError}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg py-2 text-sm transition-colors">
              {isSubmitting ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Groups() {
  const navigate = useNavigate()
  const { groups, isLoading, error, refetch } = useGroups()
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const { showToast } = useToast()

  function handleCreated(group: Group) {
    setShowModal(false)
    refetch()
    showToast(`Group "${group.name}" created`)
    navigate(`/groups/${group.id}`)
  }

  return (
    <div>
      <PageHeader
        title="Groups"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + New group
          </button>
        }
      />

      <main className="px-6 py-6 max-w-4xl">
        {!isLoading && !error && groups.length === 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-5">How SplitIt works</h3>
            <div className="space-y-5">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-violet-600/10 flex items-center justify-center text-xl flex-shrink-0">{step.icon}</div>
                  <div>
                    <p className="font-medium text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowModal(true)} className="mt-6 w-full bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl py-2.5 text-sm transition-colors">
              Create your first group →
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonGroupCard key={i} />)}</div>
        )}

        {error && <p className="text-sm text-red-500 py-12">{error}</p>}

        {!isLoading && groups.length > 0 && (
          <ul className="space-y-3">
            {groups.map((group, i) => {
              const color = GROUP_COLORS[i % GROUP_COLORS.length]
              const canManage = group.current_user_role === 'admin'
              return (
                <li key={group.id} className="relative">
                  <div className={`${color.bg} border ${color.border} rounded-2xl shadow-sm hover:shadow-md transition-all`}>
                    <button onClick={() => navigate(`/groups/${group.id}`)} className="w-full text-left px-5 py-4 pr-20">
                      <p className="font-semibold text-gray-900">{group.name}</p>
                      {group.description && <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${color.badge}`}>
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </span>
                        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${color.badge}`}>
                          Created by {group.created_by.name}
                        </span>
                        {group.is_settled && (
                          <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700">✓ Settled up</span>
                        )}
                      </div>
                    </button>
                  </div>
                  <div className="absolute top-4 right-4 flex gap-1">
                    <button onClick={() => setEditingGroup(group)} disabled={!canManage} title={canManage ? 'Edit group' : 'Only group admins can edit'} className="p-1.5 rounded-lg hover:bg-black/10 text-gray-400 hover:text-violet-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">✎</button>
                    <button onClick={() => setDeletingGroup(group)} disabled={!canManage} title={canManage ? 'Delete group' : 'Only group admins can delete'} className="p-1.5 rounded-lg hover:bg-black/10 text-gray-400 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-lg leading-none">×</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {showModal && <CreateGroupModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      {editingGroup && (
        <EditGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSaved={() => { refetch(); setEditingGroup(null); showToast('Group updated') }}
        />
      )}

      {deletingGroup && (
        <ConfirmModal
          title="Delete group?"
          message={`"${deletingGroup.name}" and all its expenses will be permanently deleted. This cannot be undone.`}
          onConfirm={async () => {
            try {
              await api.groups.delete(deletingGroup.id)
              setDeletingGroup(null)
              refetch()
              showToast('Group deleted', 'info')
            } catch (err) {
              setDeletingGroup(null)
              showToast(getErrorMessage(err), 'error')
            }
          }}
          onClose={() => setDeletingGroup(null)}
        />
      )}
    </div>
  )
}
