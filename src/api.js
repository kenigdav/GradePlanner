const API_BASE = '/api'

const TOKEN_KEY = 'grade-planner-token'

let onAuthFailure = null

/** Register a callback for 401 responses (e.g. clear session and show login). */
export function setAuthFailureHandler(handler) {
  onAuthFailure = handler
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function getHeaders(includeAuth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (includeAuth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function handleRes(res, { requireAuth = false } = {}) {
  if (res.status === 401) {
    onAuthFailure?.()
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data.error || (res.status === 500 ? 'Server error. Check the server terminal for details.' : res.statusText)
    if (res.status === 401) {
      msg = data.error === 'Authentication required'
        ? 'Please sign in again, then retry.'
        : (data.error || 'Please sign in again, then retry.')
    }
    throw new Error(msg)
  }
  return data
}

async function authFetch(url, options = {}) {
  const token = getToken()
  if (!token) {
    onAuthFailure?.()
    throw new Error('Please sign in again, then retry.')
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  }
  const res = await fetch(url, { ...options, headers })
  return handleRes(res, { requireAuth: true })
}

export const authApi = {
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ username, password }),
    })
    return handleRes(res)
  },
  async register(fullName, email, username, password, inviteToken) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ fullName, email, username, password, inviteToken: inviteToken || undefined }),
    })
    return handleRes(res)
  },
  async changePassword(currentPassword, newPassword) {
    return authFetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  },
}

export const usersApi = {
  async list() {
    return authFetch(`${API_BASE}/users`)
  },
  async updateRole(userId, role) {
    return authFetch(`${API_BASE}/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
  async updateBan(userId, banned) {
    return authFetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ banned }),
    })
  },
  async delete(userId) {
    const token = getToken()
    if (!token) {
      onAuthFailure?.()
      throw new Error('Please sign in again, then retry.')
    }
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) onAuthFailure?.()
    if (res.status === 204) return
    return handleRes(res)
  },
  async create(fullName, email, username, password, role) {
    return authFetch(`${API_BASE}/users`, {
      method: 'POST',
      body: JSON.stringify({ fullName, email, username, password, role }),
    })
  },
}

export const calendarsApi = {
  async list() {
    return authFetch(`${API_BASE}/calendars`)
  },
  async create(name) {
    return authFetch(`${API_BASE}/calendars`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },
  async joinWithCode(code) {
    return authFetch(`${API_BASE}/calendars/join`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },
  async update(id, name) {
    return authFetch(`${API_BASE}/calendars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    })
  },
  async delete(id) {
    const token = getToken()
    if (!token) {
      onAuthFailure?.()
      throw new Error('Please sign in again, then retry.')
    }
    const res = await fetch(`${API_BASE}/calendars/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) onAuthFailure?.()
    if (res.status === 204) return
    return handleRes(res)
  },
  async listMembers(calendarId) {
    return authFetch(`${API_BASE}/calendars/${calendarId}/members`)
  },
  async addMember(calendarId, username, role) {
    return authFetch(`${API_BASE}/calendars/${calendarId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    })
  },
  async updateMemberRole(calendarId, userId, role) {
    return authFetch(`${API_BASE}/calendars/${calendarId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  },
  async removeMember(calendarId, userId) {
    if (!calendarId || !userId) {
      throw new Error('Calendar and member are required.')
    }
    const token = getToken()
    if (!token) {
      onAuthFailure?.()
      throw new Error('Please sign in again, then retry.')
    }
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) onAuthFailure?.()
    if (res.status === 204) return
    return handleRes(res)
  },
  async listInvites(calendarId) {
    return authFetch(`${API_BASE}/calendars/${calendarId}/invites`)
  },
  async createInvite(calendarId, { email, username, role }) {
    return authFetch(`${API_BASE}/calendars/${calendarId}/invites`, {
      method: 'POST',
      body: JSON.stringify({ email, username, role }),
    })
  },
  async revokeInvite(calendarId, inviteId) {
    const token = getToken()
    if (!token) {
      onAuthFailure?.()
      throw new Error('Please sign in again, then retry.')
    }
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/invites/${inviteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) onAuthFailure?.()
    if (res.status === 204) return
    return handleRes(res)
  },
}

export const invitesApi = {
  async listPending() {
    return authFetch(`${API_BASE}/invites/pending`)
  },
  async preview(token) {
    const res = await fetch(`${API_BASE}/invites/${encodeURIComponent(token)}`, {
      headers: getHeaders(false),
    })
    return handleRes(res)
  },
  async accept(token) {
    return authFetch(`${API_BASE}/invites/accept`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  },
  async decline(token) {
    return authFetch(`${API_BASE}/invites/decline`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  },
}

export const subjectsApi = {
  async list(calendarId) {
    return authFetch(`${API_BASE}/subjects?calendarId=${encodeURIComponent(calendarId)}`)
  },
  async add(subject, calendarId) {
    return authFetch(`${API_BASE}/subjects`, {
      method: 'POST',
      body: JSON.stringify({ subject, calendarId }),
    })
  },
  async remove(subject, calendarId) {
    return authFetch(`${API_BASE}/subjects`, {
      method: 'DELETE',
      body: JSON.stringify({ subject, calendarId }),
    })
  },
}

export const notifyApi = {
  async notifyDueTomorrow(calendarId) {
    return authFetch(`${API_BASE}/notify/due-tomorrow`, {
      method: 'POST',
      body: JSON.stringify({ calendarId }),
    })
  },
}

export const assignmentsApi = {
  async list(calendarId) {
    return authFetch(`${API_BASE}/assignments?calendarId=${encodeURIComponent(calendarId)}`)
  },
  async create(assignment) {
    return authFetch(`${API_BASE}/assignments`, {
      method: 'POST',
      body: JSON.stringify(assignment),
    })
  },
  async update(id, updates) {
    return authFetch(`${API_BASE}/assignments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  },
  async delete(id) {
    const token = getToken()
    if (!token) {
      onAuthFailure?.()
      throw new Error('Please sign in again, then retry.')
    }
    const res = await fetch(`${API_BASE}/assignments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401) onAuthFailure?.()
    if (res.status === 204) return
    return handleRes(res)
  },
}
