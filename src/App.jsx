import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { AssignmentForm } from './AssignmentForm'
import { CalendarView } from './CalendarView'
import { Login } from './Login'
import { Register } from './Register'
import { UserManagement } from './UserManagement'
import { SubjectManagement } from './SubjectManagement'
import { ChangePassword } from './ChangePassword'
import { assignmentsApi } from './api'
import './App.css'

export default function App() {
  const { user, loading, logout, canEdit, canManageUsers } = useAuth()
  const [authScreen, setAuthScreen] = useState('login')

  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState('')
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSubjectManagement, setShowSubjectManagement] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const handleSignOutClick = () => setShowSignOutConfirm(true)
  const handleSignOutConfirm = () => {
    setShowSignOutConfirm(false)
    logout()
  }

  const loadAssignments = async () => {
    if (!user) return
    setAssignmentsLoading(true)
    setAssignmentsError('')
    try {
      const list = await assignmentsApi.list()
      setAssignments(list)
    } catch (err) {
      setAssignmentsError(err.message || 'Failed to load assignments')
      setAssignments([])
    } finally {
      setAssignmentsLoading(false)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [user])

  const addAssignment = async (assignment) => {
    const created = await assignmentsApi.create(assignment)
    setAssignments((prev) => [...prev, created])
  }

  const deleteAssignment = async (id) => {
    await assignmentsApi.delete(id)
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  const updateAssignmentDate = async (id, date) => {
    await assignmentsApi.update(id, { date })
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, date } : a))
    )
  }

  if (loading) {
    return (
      <div className="app app--loading">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app app--auth">
        {authScreen === 'login' ? (
          <Login onSwitchToRegister={() => setAuthScreen('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthScreen('login')} />
        )}
      </div>
    )
  }

  if (user.role === 'pending') {
    return (
      <div className="app app--auth">
        <div className="auth-card">
          <h1>Assignment Planner</h1>
          <p className="auth-hint">Your account is pending approval. A contributor or administrator must approve your access.</p>
          <button type="button" className="btn btn-primary" onClick={handleSignOutClick}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1>Assignment Planner</h1>
          <p className="tagline">Track due dates by subject</p>
          <div className="header-actions">
            <span className="header-user">{user.fullName} ({user.role})</span>
            <button type="button" className="btn btn-ghost" onClick={() => setShowChangePassword(true)}>
              Change password
            </button>
            {user.role === 'administrator' && (
              <button type="button" className="btn btn-ghost" onClick={() => setShowSubjectManagement(true)}>
                Subject list
              </button>
            )}
            {canManageUsers && (
              <button type="button" className="btn btn-ghost" onClick={() => setShowUserManagement(true)}>
                {user.role === 'administrator' ? 'User management' : user.role === 'contributor' ? 'Approve viewers' : 'Users'}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={handleSignOutClick}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className={`main ${!canEdit ? 'main--calendar-only' : ''}`}>
        {canEdit && (
          <section className="panel form-panel">
            <h2>Add assignment</h2>
            <AssignmentForm onSubmit={addAssignment} />
          </section>
        )}
        <section className="panel calendar-panel">
          <h2>Calendar</h2>
          {assignmentsError && <p className="assignments-error">{assignmentsError}</p>}
          {assignmentsLoading ? (
            <p className="assignments-loading">Loading calendar...</p>
          ) : (
            <CalendarView
              assignments={assignments}
              onDelete={canEdit ? deleteAssignment : undefined}
              onUpdateDate={canEdit ? updateAssignmentDate : undefined}
              canEdit={canEdit}
            />
          )}
        </section>
      </main>
      {showSubjectManagement && (
        <div className="modal-backdrop" onClick={() => setShowSubjectManagement(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SubjectManagement onClose={() => setShowSubjectManagement(false)} />
          </div>
        </div>
      )}
      {showUserManagement && (
        <div className="modal-backdrop" onClick={() => setShowUserManagement(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <UserManagement onClose={() => setShowUserManagement(false)} />
          </div>
        </div>
      )}
      {showChangePassword && (
        <div className="modal-backdrop" onClick={() => setShowChangePassword(false)}>
          <div className="modal-content modal-content--narrow" onClick={(e) => e.stopPropagation()}>
            <ChangePassword onClose={() => setShowChangePassword(false)} />
          </div>
        </div>
      )}
      {showSignOutConfirm && (
        <div className="modal-backdrop" onClick={() => setShowSignOutConfirm(false)}>
          <div className="modal-content modal-content--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="signout-confirm">
              <h2>Sign out</h2>
              <p>Are you sure you want to sign out?</p>
              <div className="signout-confirm-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowSignOutConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSignOutConfirm}>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
