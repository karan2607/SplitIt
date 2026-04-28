import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type Invite } from '../lib/api'
import { getErrorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'

type State =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'ready'; invite: Invite }
  | { status: 'accepting'; invite: Invite }
  | { status: 'error'; invite: Invite; message: string }

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    api.invites.get(token!)
      .then((invite) => {
        if (!invite.is_valid) {
          setState({ status: 'invalid', message: 'This invite link has expired or already been used.' })
        } else {
          setState({ status: 'ready', invite })
        }
      })
      .catch(() => setState({ status: 'invalid', message: 'Invite not found.' }))
  }, [token])

  useEffect(() => {
    if (state.status !== 'ready' || !user) return

    setState({ status: 'accepting', invite: state.invite })

    api.invites.accept(token!)
      .then((group) => navigate(`/groups/${group.id}`, { replace: true }))
      .catch((err) => {
        setState({
          status: 'error',
          invite: (state as { invite: Invite }).invite,
          message: getErrorMessage(err),
        })
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, user?.id])

  if (state.status === 'loading' || state.status === 'accepting') {
    return (
      <Screen>
        <p className="text-white/70">{state.status === 'loading' ? 'Loading invite...' : 'Joining group...'}</p>
      </Screen>
    )
  }

  if (state.status === 'invalid') {
    return (
      <Screen>
        <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 text-center">
          <p className="text-3xl mb-4">⚠️</p>
          <p className="text-gray-700 font-medium mb-4">{state.message}</p>
          <Link to="/dashboard" className="text-violet-600 hover:underline text-sm">Go to dashboard</Link>
        </div>
      </Screen>
    )
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 text-center">
          <p className="text-3xl mb-4">❌</p>
          <p className="text-gray-700 font-medium mb-2">Failed to join group</p>
          <p className="text-sm text-red-500 mb-4">{state.message}</p>
          <button
            onClick={() => setState({ status: 'ready', invite: state.invite })}
            className="text-violet-600 hover:underline text-sm"
          >
            Try again
          </button>
        </div>
      </Screen>
    )
  }

  const { invite } = state
  return (
    <Screen>
      <div className="w-full max-w-sm bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 text-center">
        <p className="text-3xl mb-4">✉️</p>
        <h1 className="text-xl font-bold text-gray-900 mb-1">You're invited!</h1>
        <p className="text-gray-500 text-sm mb-6">
          <span className="font-medium text-gray-700">{invite.invited_by.name}</span> invited you to join{' '}
          <span className="font-medium text-gray-700">{invite.group.name}</span>
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Create an account or sign in to join the group automatically.
        </p>
        <div className="space-y-3">
          <Link
            to={`/signup?next=/invite/${token}`}
            className="block w-full bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg py-2 text-sm transition-colors"
          >
            Create account
          </Link>
          <Link
            to={`/login?next=/invite/${token}`}
            className="block w-full border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg py-2 text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-violet-900 via-violet-700 to-indigo-800 px-4">
      {children}
    </div>
  )
}
