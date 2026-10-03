import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthContext'
import { useCalendar } from './CalendarContext'
import { AssignmentForm } from './AssignmentForm'
import { CalendarView } from './CalendarView'
import { Login } from './Login'
import { Register } from './Register'
import { UserManagement } from './UserManagement'
import { SubjectManagement } from './SubjectManagement'
import { ChangePassword } from './ChangePassword'
import { CalendarPicker } from './CalendarPicker'
import { CalendarMembers } from './CalendarMembers'
import { InviteAccept, clearInviteFromUrl, readInviteToken } from './InviteAccept'
import { assignmentsApi, notifyApi, calendarsApi, invitesApi } from './api'
import { useRealtimeSync } from './useRealtimeSync'
import './App.css'

const THEME_KEY = 'grade-planner-theme'

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

const APP_ROLE_DESCRIPTIONS = {
  administrator: {
    label: 'Administrator (app)',
    abilities: [
      'Manage all users and change app roles',
      'Ban or delete accounts',
      'Approve pending registrations',
    ],
  },
  contributor: {
    label: 'Contributor (app)',
    abilities: ['Approve pending viewers'],
  },
  viewer: {
    label: 'Viewer (app)',
    abilities: ['Signed in and approved to use calendars'],
  },
  pending: {
    label: 'Pending',
    abilities: ['Waiting for a contributor or administrator to approve access'],
  },
}

const CALENDAR_ROLE_DESCRIPTIONS = {
  owner: {
    label: 'Owner',
    abilities: [
      'Add, edit, and delete assignments',
      'Invite members and change calendar roles',
      'Manage subjects and send due-tomorrow emails',
      'Rename or delete the calendar',
    ],
  },
  editor: {
    label: 'Editor',
    abilities: [
      'Add, edit, and delete assignments',
      'Drag assignments to reschedule',
      'View members',
    ],
  },
  viewer: {
    label: 'Viewer',
    abilities: ['View the calendar and assignments'],
  },
}

function RoleInfoPanel({ appRole, calendarRole, onClose }) {
  const appInfo = APP_ROLE_DESCRIPTIONS[appRole] || { label: appRole, abilities: [] }
  const calInfo = calendarRole
    ? CALENDAR_ROLE_DESCRIPTIONS[calendarRole] || { label: calendarRole, abilities: [] }
    : null
  return (
    <div className="role-info-panel">
      <div className="role-info-header">
        <h2 className="role-info-title">Your roles</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      {calInfo && (
        <>
          <h3 className="role-info-subtitle">This calendar: {calInfo.label}</h3>
          <ul className="role-info-list">
            {calInfo.abilities.map((a, i) => (
              <li key={`c-${i}`}>{a}</li>
            ))}
          </ul>
        </>
      )}
      <h3 className="role-info-subtitle">App: {appInfo.label}</h3>
      <ul className="role-info-list">
        {appInfo.abilities.map((a, i) => (
          <li key={`a-${i}`}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

export default function App() {
  const { user, loading, logout, canManageUsers, updateUser } = useAuth()
  const {
    activeCalendar,
    activeCalendarId,
    setActiveCalendarId,
    canEdit,
    canManage,
    myRole,
    refreshCalendars,
  } = useCalendar()

  const [authScreen, setAuthScreen] = useState('login')
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [inviteToken, setInviteToken] = useState(() => readInviteToken())
  const [invitePreview, setInvitePreview] = useState(null)

  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [assignmentsError, setAssignmentsError] = useState('')
  const [showUserManagement, setShowUserManagement] = useState(false)
  const [showSubjectManagement, setShowSubjectManagement] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [notifyStatus, setNotifyStatus] = useState(null)
  const [notifyStatusOk, setNotifyStatusOk] = useState(false)
  const [showSideMenu, setShowSideMenu] = useState(false)
  const [showRoleInfo, setShowRoleInfo] = useState(false)
  const [pickedDueDate, setPickedDueDate] = useState(null)
  const [calendarUpdatedToast, setCalendarUpdatedToast] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showRename, setShowRename] = useState(false)
  const assignmentsLoadedOnceRef = useRef(false)

  useEffect(() => {
    if (!inviteToken) return
    invitesApi
      .preview(inviteToken)
      .then(setInvitePreview)
      .catch(() => setInvitePreview(null))
  }, [inviteToken])

  const handleNotifyDueTomorrow = async () => {
    if (!activeCalendarId) return
    setNotifyStatus(null)
    try {
      const data = await notifyApi.notifyDueTomorrow(activeCalendarId)
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
    if (!user || !activeCalendarId) {
      setAssignments([])
      setAssignmentsLoading(false)
      return
    }
    const isInitialLoad = !assignmentsLoadedOnceRef.current
    if (isInitialLoad) setAssignmentsLoading(true)
    setAssignmentsError('')
    try {
      const list = await assignmentsApi.list(activeCalendarId)
      setAssignments(list)
      assignmentsLoadedOnceRef.current = true
    } catch (err) {
      setAssignmentsError(err.message || 'Failed to load assignments')
      setAssignments([])
    } finally {
      setAssignmentsLoading(false)
    }
  }

  useEffect(() => {
    if (!user || !activeCalendarId) assignmentsLoadedOnceRef.current = false
  }, [user, activeCalendarId])

  useEffect(() => {
    loadAssignments()
  }, [user, activeCalendarId])

  useRealtimeSync({
    enabled: !!user && user.role !== 'pending',
    calendarId: activeCalendarId,
    onAssignmentsChanged: () => {
      setCalendarUpdatedToast(true)
      loadAssignments()
      setTimeout(() => setCalendarUpdatedToast(false), 3000)
    },
    onCalendarsChanged: () => {
      refreshCalendars()
    },
    onReconnect: () => {
      loadAssignments()
      refreshCalendars()
      window.dispatchEvent(new CustomEvent('grade-planner-subjects-changed'))
    },
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const addAssignment = async (assignment) => {
    await assignmentsApi.create({ ...assignment, calendarId: activeCalendarId })
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

  const handleRename = async (e) => {
    e.preventDefault()
    if (!activeCalendarId || !renameValue.trim()) return
    try {
      await calendarsApi.update(activeCalendarId, renameValue.trim())
      await refreshCalendars()
      setShowRename(false)
    } catch (err) {
      setNotifyStatusOk(false)
      setNotifyStatus(err.message || 'Failed to rename')
    }
  }

  const handleDeleteCalendar = async () => {
    if (!activeCalendarId) return
    if (!window.confirm(`Delete calendar "${activeCalendar?.name}"? This cannot be undone.`)) return
    try {
      await calendarsApi.delete(activeCalendarId)
      setActiveCalendarId(null)
      await refreshCalendars()
    } catch (err) {
      setNotifyStatusOk(false)
      setNotifyStatus(err.message || 'Failed to delete calendar')
    }
  }

  const handleInviteNeedAuth = (token, preview) => {
    setInviteToken(token)
    setInvitePreview(preview || null)
    setAuthScreen(user ? 'login' : 'register')
  }

  const handleRegistered = async (result) => {
    if (result?.acceptedCalendar?.id) {
      clearInviteFromUrl()
      setInviteToken('')
      setActiveCalendarId(result.acceptedCalendar.id)
    } else if (inviteToken && user) {
      try {
        const accepted = await invitesApi.accept(inviteToken)
        if (accepted.user) updateUser(accepted.user)
        if (accepted.calendar?.id) setActiveCalendarId(accepted.calendar.id)
        clearInviteFromUrl()
        setInviteToken('')
        await refreshCalendars()
      } catch {
        /* user can accept from banner */
      }
    }
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
        {inviteToken && (
          <InviteAccept onNeedAuth={handleInviteNeedAuth} />
        )}
        {authScreen === 'login' ? (
          <Login onSwitchToRegister={() => setAuthScreen('register')} />
        ) : (
          <Register
            onSwitchToLogin={() => setAuthScreen('login')}
            inviteToken={inviteToken || undefined}
            inviteEmail={invitePreview?.email || undefined}
            onRegistered={handleRegistered}
          />
        )}
      </div>
    )
  }

  if (user.role === 'pending' && !inviteToken) {
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

  // Pending user with invite can accept and get upgraded
  if (user.role === 'pending' && inviteToken) {
    return (
      <div className="app app--auth">
        <ThemeToggle theme={theme} onToggle={toggleTheme} className="theme-toggle--auth" />
        <InviteAccept />
        <button type="button" className="btn btn-ghost" onClick={handleSignOutConfirm} style={{ marginTop: '1rem' }}>
          Sign out
        </button>
      </div>
    )
  }

  if (!activeCalendarId) {
    return (
      <div className="app app--auth">
        <ThemeToggle theme={theme} onToggle={toggleTheme} className="theme-toggle--auth" />
        {inviteToken && <InviteAccept onNeedAuth={handleInviteNeedAuth} />}
        <CalendarPicker />
        <button type="button" className="btn btn-ghost" onClick={handleSignOutClick} style={{ marginTop: '1rem' }}>
          Sign out
        </button>
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

  const closeMenu = () => setShowSideMenu(false)
  const menuAction = (fn) => () => { closeMenu(); fn() }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1>{activeCalendar?.name || 'Assignment Planner'}</h1>
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
              {user.fullName} ({myRole || user.role})
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
      {inviteToken && (
        <div className="invite-banner-wrap">
          <InviteAccept onNeedAuth={handleInviteNeedAuth} />
        </div>
      )}
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
              <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setActiveCalendarId(null))}>
                Switch calendar
              </button>
              <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setShowMembers(true))}>
                Members & invites
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost side-menu-item"
                    onClick={menuAction(() => {
                      setRenameValue(activeCalendar?.name || '')
                      setShowRename(true)
                    })}
                  >
                    Rename calendar
                  </button>
                  <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setShowSubjectManagement(true))}>
                    Subject list
                  </button>
                  <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(handleNotifyDueTomorrow)}>
                    Email due tomorrow
                  </button>
                  <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(handleDeleteCalendar)}>
                    Delete calendar
                  </button>
                </>
              )}
              <button type="button" className="btn btn-ghost side-menu-item" onClick={menuAction(() => setShowChangePassword(true))}>
                Change password
              </button>
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
            <AssignmentForm
              onSubmit={addAssignment}
              suggestedDueDate={pickedDueDate}
              calendarId={activeCalendarId}
            />
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
              onDateClick={setPickedDueDate}
              canEdit={canEdit}
            />
          )}
        </section>
      </main>
      {showSubjectManagement && (
        <div className="modal-backdrop" onClick={() => setShowSubjectManagement(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SubjectManagement onClose={() => setShowSubjectManagement(false)} calendarId={activeCalendarId} />
          </div>
        </div>
      )}
      {showMembers && (
        <div className="modal-backdrop" onClick={() => setShowMembers(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <CalendarMembers onClose={() => setShowMembers(false)} />
          </div>
        </div>
      )}
      {showRename && (
        <div className="modal-backdrop" onClick={() => setShowRename(false)}>
          <div className="modal-content modal-content--narrow" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleRename} className="signout-confirm">
              <h2>Rename calendar</h2>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                style={{ width: '100%', marginBottom: '1rem', padding: '0.6rem' }}
                required
              />
              <div className="signout-confirm-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRename(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
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
            <RoleInfoPanel appRole={user.role} calendarRole={myRole} onClose={() => setShowRoleInfo(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
