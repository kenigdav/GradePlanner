import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from './api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'grade-planner-token'
const USER_KEY = 'grade-planner-user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem(USER_KEY)
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const { token, user: u } = await authApi.login(username, password)
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    return u
  }

  const register = async (fullName, email, username, password) => {
    const { token, user: u } = await authApi.register(fullName, email, username, password)
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  const changePassword = async (currentPassword, newPassword) => {
    await authApi.changePassword(currentPassword, newPassword)
  }

  const isViewer = user?.role === 'viewer'
  const isContributor = user?.role === 'contributor'
  const isAdmin = user?.role === 'administrator'
  const canEdit = isContributor || isAdmin
  const canManageUsers = isViewer || isContributor || isAdmin
  const canChangeRoles = isAdmin

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        changePassword,
        isViewer,
        isContributor,
        isAdmin,
        canEdit,
        canManageUsers,
        canChangeRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
