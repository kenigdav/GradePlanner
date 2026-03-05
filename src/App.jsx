import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { AssignmentForm } from './AssignmentForm'
import { CalendarView } from './CalendarView'
import { Login } from './Login'
import { Register } from './Register'
import { UserManagement } from './UserManagement'
import { SubjectManagement } from './SubjectManagement'
import { ChangePassword } from './ChangePassword'
import { assignmentsApi, notifyApi, subjectsApi } from './api'
import { useRealtimeSync } from './useRealtimeSync'
import './App.css'

const THEME_KEY = 'grade-planner-theme'
const SUBJECTS_CHANGED_EVENT = 'grade-planner-subjects-changed'

function ThemeToggle({ theme, onToggle, className = '' }) {
  const isLight = theme === 'light'
  return (
    <button
      type="button"
      className={`btn btn-ghost theme-toggle ${className}`}
      onClick={onToggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
    >
      {isLight ? 'Dark' : 'Light'}
    </button>
  )
}

const ROLE_DESCRIPTIONS = {
  administrator: {
    label: 'Administrator',
    abilities: [
      'Add, edit, and delete assignments',
      'Drag assignments to reschedule',
      'Manage subjects (add, rename, delete)',
      'Manage all users and change roles',
      'Send "due tomorrow" email notifications',
    ],
  },
  contributor: {
    label: 'Contributor',
    abilities: [
      'Add, edit, and delete assignments',
      'Drag assignments to reschedule',
      'Approve pending viewers',
    ],
  },
  viewer: {
    label: 'Viewer',
    abilities: [
      'View the calendar and all assignments',
      'View other users',
    ],
  },
  pending: {
    label: 'Pending',
    abilities: [
      'Waiting for a contributor or administrator to approve access',
    ],
  },
}

function RoleInfoPanel({ role, onClose }) {
  const info = ROLE_DESCRIPTIONS[role] || { label: role, abilities: [] }
  return (
    <div className="role-info-panel">
      <div className="role-info-header">
        <h2 className="role-info-title">{info.label}</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      <ul className="role-info-list">
        {info.abilities.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

function SubjectPersonalizePanel({
  subjects,
  selectedSubjects,
  onToggleSubject,
  onSelectAll,
  onClearAll,
  onClose,
}) {
  return (
    <div className="subject-personalize">
      <div className="subject-personalize-header">
        <h2>Personalize subjects</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="subject-personalize-hint">Choose which subjects appear on your calendar. By default, all subjects are selected.</p>
      <div className="subject-personalize-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSelectAll}>Select all</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClearAll}>Clear all</button>
      </div>
      <div className="subject-personalize-list">
        {subjects.length === 0 ? (
          <p className="subject-personalize-empty">No subjects available yet.</p>
        ) : (
          subjects.map((subject) => (
            <label key={subject} className="subject-personalize-row">
              <input
                type="checkbox"
                checked={selectedSubjects.includes(subject)}
                onChange={() => onToggleSubject(subject)}
              />
              <span>{subject}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading, logout, canEdit, canManageUsers } = useAuth()
  const [authScreen, setAuthScreen] = useState('login')
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')

  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState('')
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSubjectManagement, setShowSubjectManagement] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [notifyStatus, setNotifyStatus] = useState(null)
  const [notifyStatusOk, setNotifyStatusOk] = useState(false)
  const [showSideMenu, setShowSideMenu] = useState(false)
  const [showRoleInfo, setShowRoleInfo] = useState(false)
  const [pickedDueDate, setPickedDueDate] = useState(null)
  const [calendarUpdatedToast, setCalendarUpdatedToast] = useState(false)
  const [showSubjectPersonalize, setShowSubjectPersonalize] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const assignmentsLoadedOnceRef = useRef(false)
  const subjectsInitializedRef = useRef(false)
  const subjectFilterStorageKey = user?.id
    ? `grade-planner-subject-filter:${user.id}`
    : user?.username
      ? `grade-planner-subject-filter:${user.username}`
      : null

  const handleNotifyDueTomorrow = async () => {
    setNotifyStatus(null)
    try {
      const data = await notifyApi.notifyDueTomorrow()
      setNotifyStatusOk(true)
      setNotifyStatus(data.message || `Emails sent to ${data.sent} user(s).`)
      setTimeout(() => { setNotifyStatus(null) }, 5000)
    } catch (err) {
      setNotifyStatusOk(false)
      setNotifyStatus(err.message || 'Failed to send emails')
      setTimeout(() => { setNotifyStatus(null) }, 6000)
    }
  }

  const handleSignOutClick = () => setShowSignOutConfirm(true)
  const handleSignOutConfirm = () => {
    setShowSignOutConfirm(false)
    logout()
  }

  const loadAssignments = async () => {
    if (!user) return
    const isInitialLoad = !assignmentsLoadedOnceRef.current
    if (isInitialLoad) setAssignmentsLoading(true)
    setAssignmentsError('')
    try {
      const list = await assignmentsApi.list()
      setAssignments(list)
      assignmentsLoadedOnceRef.current = true
    } catch (err) {
      setAssignmentsError(err.message || 'Failed to load assignments')
      setAssignments([])
    } finally {
      setAssignmentsLoading(false)
    }
  }

  const loadSubjects = async () => {
    if (!user) return
    try {
      const list = await subjectsApi.list()
      setSubjects(Array.isArray(list) ? list : [])
    } catch {
      // Keep subject filtering functional from assignment data even if subjects API fails.
      setSubjects([])
    }
  }

  useEffect(() => {
    if (!user) assignmentsLoadedOnceRef.current = false
  }, [user])

  useEffect(() => {
    loadAssignments()
  }, [user])

  useEffect(() => {
    loadSubjects()
  }, [user])

  useEffect(() => {
    const onSubjectsChanged = () => loadSubjects()
    window.addEventListener(SUBJECTS_CHANGED_EVENT, onSubjectsChanged)
    return () => window.removeEventListener(SUBJECTS_CHANGED_EVENT, onSubjectsChanged)
  }, [user])

  useRealtimeSync({
    enabled: !!user,
    onAssignmentsChanged: () => {
      setCalendarUpdatedToast(true)
      loadAssignments()
      setTimeout(() => setCalendarUpdatedToast(false), 3000)
    },
    onReconnect: () => {
      loadAssignments()
      window.dispatchEvent(new CustomEvent('grade-planner-subjects-changed'))
    },
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    subjectsInitializedRef.current = false
  }, [subjectFilterStorageKey])

  const availableSubjects = useMemo(() => {
    const set = new Set(subjects)
    assignments.forEach((a) => {
      if (a.subject) set.add(a.subject)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [subjects, assignments])

  useEffect(() => {
    setSelectedSubjects((prev) => {
      if (!subjectsInitializedRef.current) {
        subjectsInitializedRef.current = true
        if (subjectFilterStorageKey) {
          try {
            const raw = localStorage.getItem(subjectFilterStorageKey)
            if (raw) {
              const saved = JSON.parse(raw)
              if (Array.isArray(saved)) {
                return availableSubjects.filter((subject) => saved.includes(subject))
              }
            }
          } catch {
            // Fall back to default selection when storage is malformed.
          }
        }
        return availableSubjects
      }
      const prevSet = new Set(prev)
      const retained = availableSubjects.filter((subject) => prevSet.has(subject))
      const added = availableSubjects.filter((subject) => !prevSet.has(subject))
      return [...retained, ...added]
    })
  }, [availableSubjects, subjectFilterStorageKey])

  useEffect(() => {
    if (!subjectFilterStorageKey || !subjectsInitializedRef.current) return
    localStorage.setItem(subjectFilterStorageKey, JSON.stringify(selectedSubjects))
  }, [selectedSubjects, subjectFilterStorageKey])

  const filteredAssignments = useMemo(() => {
    if (selectedSubjects.length === 0) return []
    const selected = new Set(selectedSubjects)
    return assignments.filter((assignment) => selected.has(assignment.subject))
  }, [assignments, selectedSubjects])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const addAssignment = async (assignment) => {
    await assignmentsApi.create(assignment)
    await loadAssignments()
  }

  const deleteAssignment = async (id) => {
    await assignmentsApi.delete(id)
    await loadAssignments()
  }

  const updateAssignmentDate = async (id, date) => {
    await assignmentsApi.update(id, { date })
    await loadAssignments()
  }

  const handleToggleSubject = (subject) => {
    setSelectedSubjects((prev) => (
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    ))
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
        <ThemeToggle theme={theme} onToggle={toggleTheme} className="theme-toggle--auth" />
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
        <ThemeToggle theme={theme} onToggle={toggleTheme} className="theme-toggle--auth" />
        <div className="auth-card auth-card--pending">
          <h1>Assignment Planner</h1>
          <p className="auth-hint">Your account is pending approval. A contributor or administrator must approve your access.</p>
          <button type="button" className="btn btn-primary" onClick={handleSignOutConfirm}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const closeMenu = () => setShowSideMenu(false)
  const menuAction = (fn) => () => { closeMenu(); fn() }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="header-personalize-wrap">
            <button
              type="button"
              className="btn btn-primary header-personalize-btn"
              onClick={() => setShowSubjectPersonalize(true)}
            >
              Personalize subjects
            </button>
          </div>
          <h1>Assignment Planner</h1>
          <p className="tagline">Track due dates by subject</p>
          <div className="header-menu-wrap">
            <button
              type="button"
              className="btn btn-ghost header-menu-btn"
              onClick={() => setShowSideMenu(true)}
              aria-label="Open menu"
              aria-expanded={showSideMenu}
            >
              Menu
            </button>
          </div>
          <div className="header-actions">
            <button type="button" className="header-user header-user--btn" onClick={() => setShowRoleInfo(true)}>
              {user.fullName} ({user.role})
            </button>
          </div>
          {notifyStatus && (
            <p className={`header-notify-status ${notifyStatusOk ? 'header-notify-status--ok' : 'header-notify-status--err'}`}>
              {notifyStatus}
            </p>
          )}
          {calendarUpdatedToast && (
            <p className="header-notify-status header-notify-status--ok" role="status">
              Calendar updated
            </p>
          )}
        </div>
      </header>
      {showSideMenu && (
        <>
          <div className="side-menu-backdrop" onClick={closeMenu} aria-hidden="true" />
          <aside className="side-menu" role="dialog" aria-label="Menu">
            <div className="side-menu-header">
              <h2 className="side-menu-title">Menu</h2>
              <button type="button" className="btn btn-ghost side-menu-close" onClick={closeMenu} aria-label="Close menu">
                ×
              </button>
            </div>
            <nav className="side-menu-nav">
              <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setShowChangePassword(true))}>
                Change password
              </button>
              {user.role === 'administrator' && (
                <>
                  <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setShowSubjectManagement(true))}>
                    Subject list
                  </button>
                  <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(handleNotifyDueTomorrow)}>
                    Email due tomorrow
                  </button>
                </>
              )}
              {canManageUsers && (
                <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setShowUserManagement(true))}>
                  {user.role === 'administrator' ? 'User management' : user.role === 'contributor' ? 'Approve viewers' : 'Users'}
                </button>
              )}
              <ThemeToggle theme={theme} onToggle={toggleTheme} className="side-menu-item side-menu-item--block" />
              <div className="side-menu-spacer" />
              <button type="button" className="btn btn-ghost side-menu-item side-menu-item--signout" onClick={menuAction(handleSignOutClick)}>
                Sign out
              </button>
            </nav>
          </aside>
        </>
      )}
      <main className={`main ${!canEdit ? 'main--calendar-only' : ''}`}>
        {canEdit && (
          <section className="panel form-panel">
            <h2>Add assignment</h2>
            <AssignmentForm onSubmit={addAssignment} suggestedDueDate={pickedDueDate} />
          </section>
        )}
        <section className="panel calendar-panel">
          <h2>Calendar</h2>
          {assignmentsError && <p className="assignments-error">{assignmentsError}</p>}
          {assignmentsLoading ? (
            <p className="assignments-loading">Loading calendar...</p>
          ) : (
            <CalendarView
              assignments={filteredAssignments}
              onDelete={canEdit ? deleteAssignment : undefined}
              onUpdateDate={canEdit ? updateAssignmentDate : undefined}
              onDateClick={setPickedDueDate}
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
      {showRoleInfo && (
        <div className="modal-backdrop" onClick={() => setShowRoleInfo(false)}>
          <div className="modal-content modal-content--fit" onClick={(e) => e.stopPropagation()}>
            <RoleInfoPanel role={user.role} onClose={() => setShowRoleInfo(false)} />
          </div>
        </div>
      )}
      {showSubjectPersonalize && (
        <div className="modal-backdrop" onClick={() => setShowSubjectPersonalize(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SubjectPersonalizePanel
              subjects={availableSubjects}
              selectedSubjects={selectedSubjects}
              onToggleSubject={handleToggleSubject}
              onSelectAll={() => setSelectedSubjects(availableSubjects)}
              onClearAll={() => setSelectedSubjects([])}
              onClose={() => setShowSubjectPersonalize(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
