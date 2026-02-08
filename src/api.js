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
  async register(fullName, email, username, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(false),
      body: JSON.stringify({ fullName, email, username, password }),
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
  async create(fullName, email, username, password, role) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fullName, email, username, password, role }),
    })
    return handleRes(res)
  },
}

export const subjectsApi = {
  async list() {
    const res = await fetch(`${API_BASE}/subjects`, { headers: getHeaders() })
    return handleRes(res)
  },
  async add(subject) {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ subject }),
    })
    return handleRes(res)
  },
  async remove(subject) {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ subject }),
    })
    return handleRes(res)
  },
}

export const assignmentsApi = {
  async list() {
    const res = await fetch(`${API_BASE}/assignments`, { headers: getHeaders() })
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
