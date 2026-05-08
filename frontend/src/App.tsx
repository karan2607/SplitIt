import { useState, useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
import InviteAccept from './pages/InviteAccept'
import Profile from './pages/Profile'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'

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
    }, 60_000)

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

function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const [pendingFriendCount, setPendingFriendCount] = useState(0)

  useEffect(() => {
    if (!user) return
    api.friends.list().then((list) => {
      const count = list.filter(
        (f) => f.status === 'pending' && f.to_user.id === user.id
      ).length
      setPendingFriendCount(count)
    }).catch(() => {})
  }, [user, location.pathname])

  if (!user) return <>{children}</>

  return (
    <div className="flex min-h-screen bg-violet-950">
      <Sidebar pendingFriendCount={pendingFriendCount} />
      <div className="flex-1 min-w-0 bg-slate-50 md:ml-16 pb-16 md:pb-0 min-h-screen">
        {children}
      </div>
      <BottomNav pendingFriendCount={pendingFriendCount} />
    </div>
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
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/groups/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GroupDetail />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/friends"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Friends />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Profile />
            </AppLayout>
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
