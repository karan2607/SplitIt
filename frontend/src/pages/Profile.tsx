import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { api } from '../lib/api'
import { setToken } from '../lib/auth'
import { getErrorMessage } from '../lib/errors'
import { useToast } from '../components/Toast'
import Avatar from '../components/Avatar'

const nameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
})
type NameFormData = z.infer<typeof nameSchema>

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.new_password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type PasswordFormData = z.infer<typeof passwordSchema>

export default function Profile() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [nameError, setNameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const nameForm = useForm<NameFormData>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.name ?? '' },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  async function handleNameSubmit(data: NameFormData) {
    setNameError(null)
    try {
      const updated = await api.auth.updateProfile(data.name)
      // Re-sync user in auth context by refreshing token (token unchanged)
      login(localStorage.getItem('token')!, updated)
      showToast('Name updated')
    } catch (err) {
      setNameError(getErrorMessage(err))
    }
  }

  async function handlePasswordSubmit(data: PasswordFormData) {
    setPasswordError(null)
    try {
      const res = await api.auth.changePassword(data.current_password, data.new_password)
      // Server rotates the token — update stored token and keep user logged in
      setToken(res.token)
      login(res.token, user!)
      passwordForm.reset()
      showToast('Password changed')
    } catch (err) {
      setPasswordError(getErrorMessage(err))
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-r from-violet-700 to-violet-900 px-6 py-4 flex items-center gap-4 shadow-md">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-white/60 hover:text-white transition-colors text-lg leading-none"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">Profile</h1>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {/* Account info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <Avatar user={user} size="lg" />
          <div>
            <p className="font-semibold text-gray-900 text-lg">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        {/* Edit name */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Edit name</h2>
          <form onSubmit={nameForm.handleSubmit(handleNameSubmit)} noValidate className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
              <input
                {...nameForm.register('name')}
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {nameForm.formState.errors.name && (
                <p className="text-xs text-red-500 mt-1">{nameForm.formState.errors.name.message}</p>
              )}
            </div>
            {nameError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {nameError}
              </p>
            )}
            <button
              type="submit"
              disabled={nameForm.formState.isSubmitting}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {nameForm.formState.isSubmitting ? 'Saving...' : 'Save name'}
            </button>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Change password</h2>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} noValidate className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
              <input
                {...passwordForm.register('current_password')}
                type="password"
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {passwordForm.formState.errors.current_password && (
                <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.current_password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                {...passwordForm.register('new_password')}
                type="password"
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {passwordForm.formState.errors.new_password && (
                <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.new_password.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                {...passwordForm.register('confirm')}
                type="password"
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {passwordForm.formState.errors.confirm && (
                <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirm.message}</p>
              )}
            </div>
            {passwordError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {passwordForm.formState.isSubmitting ? 'Changing...' : 'Change password'}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div className="pt-2">
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }) }}
            className="text-sm text-rose-600 hover:underline"
          >
            Log out
          </button>
        </div>
      </main>
    </div>
  )
}
