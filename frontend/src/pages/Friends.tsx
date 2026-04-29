import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Friendship, type User } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { getErrorMessage } from '../lib/errors'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'

type FriendshipWithOther = Friendship & { other: User }

function enrichFriendships(friendships: Friendship[], myId: string): FriendshipWithOther[] {
  return friendships.map((f) => ({
    ...f,
    other: f.from_user.id === myId ? f.to_user : f.from_user,
  }))
}

export default function Friends() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [friendships, setFriendships] = useState<FriendshipWithOther[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.friends.list()
      .then((list) => setFriendships(enrichFriendships(list, user!.id)))
      .finally(() => setLoadingFriends(false))
  }, [user])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await api.users.search(query.trim())
        setSearchResults(results)
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [query])

  async function handleSendRequest(userId: string) {
    setPendingAdd(userId)
    try {
      const friendship = await api.friends.send(userId)
      setFriendships((prev) => [...prev, { ...friendship, other: friendship.to_user }])
      showToast('Friend request sent')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setPendingAdd(null)
    }
  }

  async function handleAccept(friendshipId: string) {
    setPendingAction(friendshipId)
    try {
      const updated = await api.friends.accept(friendshipId)
      setFriendships((prev) =>
        prev.map((f) => (f.id === friendshipId ? { ...updated, other: f.other } : f))
      )
      showToast('Friend request accepted')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  async function handleRemove(friendshipId: string, name: string) {
    setPendingAction(friendshipId)
    try {
      await api.friends.remove(friendshipId)
      setFriendships((prev) => prev.filter((f) => f.id !== friendshipId))
      showToast(`Removed ${name}`, 'info')
    } catch (err) {
      showToast(getErrorMessage(err), 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const accepted = friendships.filter((f) => f.status === 'accepted')
  const incomingPending = friendships.filter(
    (f) => f.status === 'pending' && f.to_user.id === user?.id
  )
  const outgoingPending = friendships.filter(
    (f) => f.status === 'pending' && f.from_user.id === user?.id
  )

  // IDs already in some friendship state — used to label search results
  const knownIds = new Set(friendships.map((f) => f.other.id))

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
        <h1 className="text-xl font-bold text-white">Friends</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Find people</h2>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or @username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Searching…</span>
            )}
          </div>

          {query.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-sm text-gray-400 mt-3 text-center">No users found for "{query}"</p>
          )}

          {searchResults.length > 0 && (
            <ul className="mt-3 space-y-2">
              {searchResults.map((u) => {
                const friendship = friendships.find((f) => f.other.id === u.id)
                const isKnown = knownIds.has(u.id)
                return (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        {u.username && <p className="text-xs text-gray-400">@{u.username}</p>}
                      </div>
                    </div>
                    {isKnown ? (
                      <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
                        {friendship?.status === 'accepted' ? 'Friends' : 'Pending'}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(u.id)}
                        disabled={pendingAdd === u.id}
                        className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {pendingAdd === u.id ? '…' : 'Add friend'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Incoming requests */}
        {incomingPending.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Friend requests
              <span className="ml-2 text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">
                {incomingPending.length}
              </span>
            </h2>
            <ul className="space-y-3">
              {incomingPending.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={f.other} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.other.name}</p>
                      {f.other.username && <p className="text-xs text-gray-400">@{f.other.username}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(f.id)}
                      disabled={pendingAction === f.id}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {pendingAction === f.id ? '…' : 'Accept'}
                    </button>
                    <button
                      onClick={() => handleRemove(f.id, f.other.name)}
                      disabled={pendingAction === f.id}
                      className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Friends list */}
        <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            Your friends
            {accepted.length > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">{accepted.length}</span>
            )}
          </h2>

          {loadingFriends && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-gray-200" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loadingFriends && accepted.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No friends yet. Search for people to add them.
            </p>
          )}

          {!loadingFriends && accepted.length > 0 && (
            <ul className="space-y-3">
              {accepted.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={f.other} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.other.name}</p>
                      {f.other.username && <p className="text-xs text-gray-400">@{f.other.username}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(f.id, f.other.name)}
                    disabled={pendingAction === f.id}
                    className="text-xs text-gray-400 hover:text-rose-500 disabled:opacity-50 transition-colors"
                    aria-label="Remove friend"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Outgoing pending */}
        {outgoingPending.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3 text-gray-500">Sent requests</h2>
            <ul className="space-y-3">
              {outgoingPending.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar user={f.other} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{f.other.name}</p>
                      {f.other.username && <p className="text-xs text-gray-400">@{f.other.username}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(f.id, f.other.name)}
                    disabled={pendingAction === f.id}
                    className="text-xs border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-50 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
