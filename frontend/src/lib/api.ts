const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface User {
  id: string
  name: string
  email: string
  avatar_url: string | null
  created_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  // Don't set Content-Type for FormData — browser sets it with the correct multipart boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers['Authorization'] = `Token ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message =
      body.detail ||
      Object.values(body).flat().join(' ') ||
      `Request failed (${res.status})`
    throw new ApiError(res.status, message as string)
  }

  // 204 No Content or empty body
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json()
}

export interface GroupMember {
  id: string
  user: User
  role: 'admin' | 'member'
  joined_at: string
}

export interface Group {
  id: string
  name: string
  description: string | null
  created_by: User
  member_count: number
  created_at: string
}

export interface GroupDetail extends Group {
  members: GroupMember[]
}

export interface ExpenseSplit {
  id: string
  user: User
  amount_owed: string
}

export interface Expense {
  id: string
  description: string
  amount: string
  paid_by: User
  date: string
  created_by: User
  created_at: string
  is_settlement: boolean
  splits: ExpenseSplit[]
}

export interface Balance {
  from_user: User
  to_user: User
  amount: string
}

export interface Invite {
  id: string
  group: Group
  invited_email: string
  invited_by: User
  expires_at: string
  is_valid: boolean
  token: string
  url?: string
}

export const api = {
  auth: {
    signup: (data: { name: string; email: string; password: string }) =>
      request<AuthResponse>('/api/auth/signup/', { method: 'POST', body: JSON.stringify(data) }),

    login: (data: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login/', { method: 'POST', body: JSON.stringify(data) }),

    logout: () =>
      request<{ detail: string }>('/api/auth/logout/', { method: 'POST' }),

    me: () =>
      request<User>('/api/auth/me/'),

    forgotPassword: (email: string) =>
      request<{ detail: string }>('/api/auth/password-reset/', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, password: string) =>
      request<{ detail: string }>('/api/auth/password-reset/confirm/', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),

    changePassword: (current_password: string, new_password: string) =>
      request<{ token: string }>('/api/auth/password-change/', {
        method: 'POST',
        body: JSON.stringify({ current_password, new_password }),
      }),

    updateProfile: (data: { name?: string; avatar_url?: string | null }) =>
      request<User>('/api/auth/me/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  groups: {
    list: () =>
      request<Group[]>('/api/groups/'),

    create: (data: { name: string; description?: string }) =>
      request<Group>('/api/groups/', { method: 'POST', body: JSON.stringify(data) }),

    get: (id: string) =>
      request<GroupDetail>(`/api/groups/${id}/`),

    update: (id: string, data: { name?: string; description?: string }) =>
      request<GroupDetail>(`/api/groups/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id: string) =>
      request<void>(`/api/groups/${id}/`, { method: 'DELETE' }),

    invite: (groupId: string, emails: string[]) =>
      request<Invite[]>(`/api/groups/${groupId}/invite/`, {
        method: 'POST',
        body: JSON.stringify({ emails, frontend_base: window.location.origin }),
      }),

    generateLink: (groupId: string) =>
      request<Invite>(`/api/groups/${groupId}/invite-link/`, {
        method: 'POST',
        body: JSON.stringify({ frontend_base: window.location.origin }),
      }),
  },

  invites: {
    get: (token: string) =>
      request<Invite>(`/api/invite/${token}/`),

    accept: (token: string) =>
      request<GroupDetail>(`/api/invite/${token}/accept/`, { method: 'POST' }),
  },

  balances: {
    list: (groupId: string) =>
      request<{ balances: Balance[] }>(`/api/groups/${groupId}/balances/`),

    settle: (groupId: string, data: { to_user_id: string; amount: string; note?: string }) =>
      request<Expense>(`/api/groups/${groupId}/settle/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  expenses: {
    list: (groupId: string) =>
      request<Expense[]>(`/api/groups/${groupId}/expenses/`),

    create: (groupId: string, data: {
      description: string
      amount: string
      paid_by: string
      split_among?: string[]
      splits?: { user_id: string; percentage: string }[]
      date?: string
    }) =>
      request<Expense>(`/api/groups/${groupId}/expenses/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (groupId: string, expenseId: string, data: {
      description?: string
      amount?: string
      paid_by?: string
      split_among?: string[]
      splits?: { user_id: string; percentage: string }[]
      date?: string
    }) =>
      request<Expense>(`/api/groups/${groupId}/expenses/${expenseId}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (groupId: string, expenseId: string) =>
      request<void>(`/api/groups/${groupId}/expenses/${expenseId}/`, { method: 'DELETE' }),
  },

  receipt: {
    scan: (image: File) => {
      const form = new FormData()
      form.append('image', image)
      return request<{ amount: string | null; description: string | null }>(
        '/api/receipt/scan/', { method: 'POST', body: form }
      )
    },
  },
}
