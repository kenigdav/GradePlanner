import { useState, useMemo, useRef, useEffect } from 'react'
import './CalendarView.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatMonthYear(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatFullDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay()
  const daysInMonth = last.getDate()
  const pad = Array(startPad).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  return [...pad, ...days]
}

function dateKey(year, month, day) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

const DRAG_TYPE = 'application/x-grade-planner-assignment-id'

export function CalendarView({ assignments, onDelete, onUpdateDate, canEdit = true }) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [dragOverDateKey, setDragOverDateKey] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverZone, setDragOverZone] = useState(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(null)
  const [enlargedImage, setEnlargedImage] = useState(null)
  const monthChangeIntervalRef = useRef(null)
  const year = viewDate.getFullYear()

  const selectedAssignment = selectedAssignmentId
    ? assignments.find((a) => a.id === selectedAssignmentId) ?? null
    : null
  const month = viewDate.getMonth()

  const byDate = useMemo(() => {
    const map = {}
    assignments.forEach((a) => {
      if (!map[a.date]) map[a.date] = []
      map[a.date].push(a)
    })
    Object.keys(map).forEach((d) => map[d].sort((x, y) => x.subject.localeCompare(y.subject)))
    return map
  }, [assignments])

  const cells = getDaysInMonth(year, month)

  const goPrev = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  }

  const goNext = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
  }

  const goToday = () => {
    setViewDate(new Date())
  }

  const dayAssignments = selectedDate ? (byDate[selectedDate] || []) : []

  const handleDragStart = (e, assignmentId) => {
    e.dataTransfer.setData(DRAG_TYPE, assignmentId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', assignmentId)
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setDragOverDateKey(null)
    setIsDragging(false)
    setDragOverZone(null)
    if (monthChangeIntervalRef.current) {
      clearInterval(monthChangeIntervalRef.current)
      monthChangeIntervalRef.current = null
    }
  }

  useEffect(() => () => {
    if (monthChangeIntervalRef.current) clearInterval(monthChangeIntervalRef.current)
  }, [])

  useEffect(() => {
    if (selectedAssignmentId && !assignments.some((a) => a.id === selectedAssignmentId)) {
      setSelectedAssignmentId(null)
    }
  }, [assignments, selectedAssignmentId])

  const MONTH_CHANGE_DELAY_MS = 400

  const handleMonthZoneDragEnter = (direction) => {
    setDragOverZone(direction)
    if (monthChangeIntervalRef.current) return
    monthChangeIntervalRef.current = setInterval(() => {
      if (direction === 'prev') goPrev()
      else goNext()
    }, MONTH_CHANGE_DELAY_MS)
  }

  const handleMonthZoneDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverZone(null)
      if (monthChangeIntervalRef.current) {
        clearInterval(monthChangeIntervalRef.current)
        monthChangeIntervalRef.current = null
      }
    }
  }

  const handleMonthZoneDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragOver = (e, dateKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDateKey(dateKey)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDateKey(null)
  }

  const handleDrop = (e, targetDateKey) => {
    e.preventDefault()
    setDragOverDateKey(null)
    const id = e.dataTransfer.getData(DRAG_TYPE) || e.dataTransfer.getData('text/plain')
    if (id && onUpdateDate) onUpdateDate(id, targetDateKey)
  }

  return (
    <div className="calendar-view">
      {selectedDate && (
        <div className="day-view-panel">
          <div className="day-view-header">
            <h3 className="day-view-title">{formatFullDate(selectedDate)}</h3>
            <button type="button" className="btn btn-ghost day-view-close" onClick={() => setSelectedDate(null)} aria-label="Close day view">
              ×
            </button>
          </div>
          <div className="day-view-assignments">
            {dayAssignments.length === 0 ? (
              <p className="day-view-empty">No assignments this day.</p>
            ) : (
              dayAssignments.map((a) => (
                <div
                  key={a.id}
                  className={`day-view-assignment ${canEdit ? 'day-view-assignment--draggable' : ''}`}
                  draggable={canEdit}
                  onDragStart={canEdit ? (e) => handleDragStart(e, a.id) : undefined}
                  onDragEnd={canEdit ? handleDragEnd : undefined}
                >
                  <div>
                    <span className="day-view-assignment-subject">{a.subject}</span>
                    {a.createdByName && <span className="day-view-assignment-author">Posted by {a.createdByName}</span>}
                    {a.description && <p className="day-view-assignment-desc">{a.description}</p>}
                    {a.images?.length > 0 && (
                      <div className="day-view-assignment-images">
                        {a.images.slice(0, 3).map((src, i) => (
                          <button
                            key={i}
                            type="button"
                            className="day-view-assignment-img-btn"
                            onClick={(e) => { e.stopPropagation(); setEnlargedImage({ src, description: a.description || '' }) }}
                          >
                            <img src={src} alt="" />
                          </button>
                        ))}
                        {a.images.length > 3 && <span className="day-view-assignment-images-more">+{a.images.length - 3}</span>}
                      </div>
                    )}
                  </div>
                  {canEdit && onDelete && (
                    <button type="button" className="calendar-assignment-delete" onClick={() => onDelete(a.id)} aria-label={`Delete ${a.subject}`}>×</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div className="calendar-nav">
        <h3 className="calendar-title">
          {formatMonthYear(viewDate)}
        </h3>
        <button type="button" className="btn btn-ghost btn-today" onClick={goToday}>
          Today
        </button>
      </div>
      <div className="calendar-with-month-zones">
        <button
          type="button"
          className={`calendar-month-zone calendar-month-zone--prev ${dragOverZone === 'prev' ? 'calendar-month-zone--active' : ''}`}
          onClick={goPrev}
          onDragEnter={canEdit ? () => handleMonthZoneDragEnter('prev') : undefined}
          onDragLeave={canEdit ? handleMonthZoneDragLeave : undefined}
          onDragOver={canEdit ? handleMonthZoneDragOver : undefined}
          aria-label="Previous month"
        >
          <span className="calendar-month-zone-arrow">‹</span>
        </button>
        <div className="calendar-grid" role="grid" aria-label={`Calendar for ${formatMonthYear(viewDate)}`}>
        {WEEKDAYS.map((day) => (
          <div key={day} className="calendar-weekday" role="columnheader">
            {day}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="calendar-day calendar-day--empty" />
          }
          const key = dateKey(year, month, day)
          const dayAssignments = byDate[key] || []
          const isToday =
            viewDate.getFullYear() === new Date().getFullYear() &&
            viewDate.getMonth() === new Date().getMonth() &&
            day === new Date().getDate()

          return (
            <div
              key={key}
              className={`calendar-day calendar-day--clickable ${isToday ? 'calendar-day--today' : ''} ${canEdit && dragOverDateKey === key ? 'calendar-day--drop-target' : ''}`}
              role="gridcell"
              onClick={() => setSelectedDate(key)}
              onDragOver={canEdit ? (e) => handleDragOver(e, key) : undefined}
              onDragLeave={canEdit ? handleDragLeave : undefined}
              onDrop={canEdit ? (e) => handleDrop(e, key) : undefined}
            >
              <span className="calendar-day-num">{day}</span>
              <div className="calendar-day-assignments">
                {dayAssignments.map((a) => (
                  <div
                    key={a.id}
                    className={`calendar-assignment ${canEdit ? 'calendar-assignment--draggable' : ''} ${selectedAssignmentId === a.id ? 'calendar-assignment--selected' : ''}`}
                    title="Click to view description"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.target.closest('button')) return
                      setSelectedAssignmentId((id) => (id === a.id ? null : a.id))
                    }}
                    draggable={canEdit}
                    onDragStart={canEdit ? (e) => handleDragStart(e, a.id) : undefined}
                    onDragEnd={canEdit ? handleDragEnd : undefined}
                  >
                    <span className="calendar-assignment-subject">{a.subject}</span>
                    {canEdit && onDelete && (
                      <button
                        type="button"
                        className="calendar-assignment-delete"
                        onClick={(e) => { e.stopPropagation(); setSelectedAssignmentId((id) => (id === a.id ? null : id)); onDelete(a.id) }}
                        aria-label={`Delete ${a.subject}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        </div>
        <button
          type="button"
          className={`calendar-month-zone calendar-month-zone--next ${dragOverZone === 'next' ? 'calendar-month-zone--active' : ''}`}
          onClick={goNext}
          onDragEnter={canEdit ? () => handleMonthZoneDragEnter('next') : undefined}
          onDragLeave={canEdit ? handleMonthZoneDragLeave : undefined}
          onDragOver={canEdit ? handleMonthZoneDragOver : undefined}
          aria-label="Next month"
        >
          <span className="calendar-month-zone-arrow">›</span>
        </button>
      </div>
      {selectedAssignment && (
        <div className="assignment-detail-panel">
          <div className="assignment-detail-header">
            <span className="assignment-detail-subject">{selectedAssignment.subject}</span>
            <span className="assignment-detail-date">{formatFullDate(selectedAssignment.date)}</span>
            {selectedAssignment.createdByName && (
              <span className="assignment-detail-author">Posted by {selectedAssignment.createdByName}</span>
            )}
            <button
              type="button"
              className="btn btn-ghost assignment-detail-close"
              onClick={() => setSelectedAssignmentId(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {selectedAssignment.description ? (
            <p className="assignment-detail-desc">{selectedAssignment.description}</p>
          ) : (
            <p className="assignment-detail-desc assignment-detail-desc--empty">No description.</p>
          )}
          {selectedAssignment.images?.length > 0 && (
            <div className="assignment-detail-images">
              {selectedAssignment.images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className="assignment-detail-img-wrap"
                  onClick={() => setEnlargedImage({ src, description: selectedAssignment.description || '' })}
                >
                  <img src={src} alt="" className="assignment-detail-img" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {enlargedImage && (
        <div
          className="image-enlarge-overlay"
          onClick={() => setEnlargedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged image"
        >
          <div className="image-enlarge-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="image-enlarge-close"
              onClick={() => setEnlargedImage(null)}
              aria-label="Close"
            >
              ×
            </button>
            <img src={enlargedImage.src} alt="" className="image-enlarge-img" />
            {enlargedImage.description ? (
              <p className="image-enlarge-desc">{enlargedImage.description}</p>
            ) : (
              <p className="image-enlarge-desc image-enlarge-desc--empty">No description.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
