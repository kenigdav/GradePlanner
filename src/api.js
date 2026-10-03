const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('grade-planner-token')
}

function getHeaders(includeAuth = true) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (includeAuth && token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function handleRes(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.error || (res.status === 500 ? 'Server error. Check the server terminal for details.' : res.statusText)
    throw new Error(msg)
  }
  return data
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
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    return handleRes(res)
  },
}

export const usersApi = {
  async list() {
    const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() })
    return handleRes(res)
  },
  async updateRole(userId, role) {
    const res = await fetch(`${API_BASE}/users/${userId}/role`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    })
    return handleRes(res)
  },
  async updateBan(userId, banned) {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ banned }),
    })
    return handleRes(res)
  },
  async delete(userId) {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (res.status === 204) return
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText)
  },
  async create(fullName, email, username, password, role) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fullName, email, username, password, role }),
    })
    return handleRes(res)
  },
}

export const calendarsApi = {
  async list() {
    const res = await fetch(`${API_BASE}/calendars`, { headers: getHeaders() })
    return handleRes(res)
  },
  async create(name) {
    const res = await fetch(`${API_BASE}/calendars`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    })
    return handleRes(res)
  },
  async update(id, name) {
    const res = await fetch(`${API_BASE}/calendars/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    })
    return handleRes(res)
  },
  async delete(id) {
    const res = await fetch(`${API_BASE}/calendars/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (res.status === 204) return
    return handleRes(res)
  },
  async listMembers(calendarId) {
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/members`, { headers: getHeaders() })
    return handleRes(res)
  },
  async updateMemberRole(calendarId, userId, role) {
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/members/${userId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    })
    return handleRes(res)
  },
  async removeMember(calendarId, userId) {
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/members/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (res.status === 204) return
    return handleRes(res)
  },
  async listInvites(calendarId) {
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/invites`, { headers: getHeaders() })
    return handleRes(res)
  },
  async createInvite(calendarId, { email, username, role }) {
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/invites`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, username, role }),
    })
    return handleRes(res)
  },
  async revokeInvite(calendarId, inviteId) {
    const res = await fetch(`${API_BASE}/calendars/${calendarId}/invites/${inviteId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (res.status === 204) return
    return handleRes(res)
  },
}

export const invitesApi = {
  async listPending() {
    const res = await fetch(`${API_BASE}/invites/pending`, { headers: getHeaders() })
    return handleRes(res)
  },
  async preview(token) {
    const res = await fetch(`${API_BASE}/invites/${encodeURIComponent(token)}`, {
      headers: getHeaders(false),
    })
    return handleRes(res)
  },
  async accept(token) {
    const res = await fetch(`${API_BASE}/invites/accept`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ token }),
    })
    return handleRes(res)
  },
  async decline(token) {
    const res = await fetch(`${API_BASE}/invites/decline`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ token }),
    })
    return handleRes(res)
  },
}

export const subjectsApi = {
  async list(calendarId) {
    const res = await fetch(`${API_BASE}/subjects?calendarId=${encodeURIComponent(calendarId)}`, {
      headers: getHeaders(),
    })
    return handleRes(res)
  },
  async add(subject, calendarId) {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ subject, calendarId }),
    })
    return handleRes(res)
  },
  async remove(subject, calendarId) {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ subject, calendarId }),
    })
    return handleRes(res)
  },
}

export const notifyApi = {
  async notifyDueTomorrow(calendarId) {
    const res = await fetch(`${API_BASE}/notify/due-tomorrow`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ calendarId }),
    })
    return handleRes(res)
  },
}

export const assignmentsApi = {
  async list(calendarId) {
    const res = await fetch(`${API_BASE}/assignments?calendarId=${encodeURIComponent(calendarId)}`, {
      headers: getHeaders(),
    })
    return handleRes(res)
  },
  async create(assignment) {
    const res = await fetch(`${API_BASE}/assignments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(assignment),
    })
    return handleRes(res)
  },
  async update(id, updates) {
    const res = await fetch(`${API_BASE}/assignments/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    })
    return handleRes(res)
  },
  async delete(id) {
    const res = await fetch(`${API_BASE}/assignments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    if (res.status === 204) return
    return handleRes(res)
  },
}
