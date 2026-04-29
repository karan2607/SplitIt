import { useState, useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuth } from './hooks/useAuth'
import { api, ApiError, type User } from './lib/api'
import { setToken, clearToken, getToken } from './lib/auth'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import GroupDetail from './pages/GroupDetail'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import { ToastProvider } from './components/Toast'

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const lastActiveRef = useRef(Date.now())

  useEffect(() => {
    if (!getToken()) {
      setIsLoading(false)
      return
    }
    api.auth.me()
      .then(setUser)
      .catch((err) => {
        // Only clear the token when the server explicitly rejects it (401).
        // A 502/503 during a deploy restart should not log the user out.
        if (err instanceof ApiError && err.status === 401) clearToken()
      })
      .finally(() => setIsLoading(false))
  }, [])

  function login(token: string, userData: User) {
    setToken(token)
    setUser(userData)
    lastActiveRef.current = Date.now()
  }

  function logout() {
    api.auth.logout().catch(() => {})
    clearToken()
    setUser(null)
  }

  // Auto-logout after 30 minutes of inactivity, only while logged in
  useEffect(() => {
    if (!user) return

    function onActivity() {
      lastActiveRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    const timer = setInterval(() => {
      if (Date.now() - lastActiveRef.current > INACTIVITY_TIMEOUT_MS) {
        logout()
      }
    }, 60_000) // check every minute

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity))
      clearInterval(timer)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">
      Loading...
    </div>
  )
}

function AppRoutes() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <Spinner />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedRoute>
            <GroupDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <Friends />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
