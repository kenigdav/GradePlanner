import { useState, useEffect } from 'react'
import { subjectsApi } from './api'
import './SubjectManagement.css'

const SUBJECTS_CHANGED_EVENT = 'grade-planner-subjects-changed'

export function SubjectManagement({ onClose }) {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newSubject, setNewSubject] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await subjectsApi.list()
      setSubjects(list)
    } catch (err) {
      setError(err.message || 'Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const notifySubjectsChanged = () => {
    window.dispatchEvent(new CustomEvent(SUBJECTS_CHANGED_EVENT))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    const name = newSubject.trim()
    if (!name) return
    setError('')
    try {
      await subjectsApi.add(name)
      setNewSubject('')
      await load()
      notifySubjectsChanged()
    } catch (err) {
      setError(err.message || 'Failed to add subject')
    }
  }

  const handleRemove = async (subjectName) => {
    setError('')
    try {
      await subjectsApi.remove(subjectName)
      await load()
      notifySubjectsChanged()
    } catch (err) {
      setError(err.message || 'Failed to remove subject')
    }
  }

  return (
    <div className="subject-management">
      <div className="subject-management-header">
        <h2>Subject list</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="subject-management-hint">Subjects appear in the assignment form dropdown. Add or remove them below.</p>
      <form className="subject-management-add" onSubmit={handleAdd}>
        <input
          type="text"
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="New subject name"
          className="subject-management-input"
          aria-label="New subject name"
        />
        <button type="submit" className="btn btn-primary">Add subject</button>
      </form>
      {error && <p className="subject-management-error">{error}</p>}
      {loading ? (
        <p className="subject-management-loading">Loading subjects...</p>
      ) : (
        <ul className="subject-management-list">
          {subjects.map((name) => (
            <li key={name} className="subject-management-row">
              <span className="subject-management-name">{name}</span>
              <button
                type="button"
                className="btn btn-sm btn-ghost subject-management-remove"
                onClick={() => handleRemove(name)}
                aria-label={`Remove ${name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
