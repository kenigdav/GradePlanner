import { useState, useRef, useEffect } from 'react'
import { subjectsApi } from './api'
import './AssignmentForm.css'

const today = () => new Date().toISOString().slice(0, 10)

const DEFAULT_SUBJECTS = [
  'Spanish', 'Science', 'Math', 'ELA', 'Social Studies', 'Music', 'PE', 'Engineering', 'Philosophy',
]

const MEDIA_IMAGE = 'image'
const MEDIA_VIDEO = 'video'
const MEDIA_PDF = 'pdf'

const MAX_FILE_BYTES = 45 * 1024 * 1024 // 45MB (keeps payload under server 50MB limit)

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getMediaType(file) {
  if (file.type.startsWith('image/')) return MEDIA_IMAGE
  if (file.type.startsWith('video/')) return MEDIA_VIDEO
  if (file.type === 'application/pdf') return MEDIA_PDF
  return null
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function getDaysInMonthForPicker(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay()
  const daysInMonth = last.getDate()
  const pad = Array(startPad).fill(null)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  return [...pad, ...days]
}

function dateKeyForPicker(year, month, day) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AssignmentForm({ onSubmit, suggestedDueDate }) {
  const [date, setDate] = useState(today())
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [linksText, setLinksText] = useState('')
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [pdfs, setPdfs] = useState([])
  const [subjectOptions, setSubjectOptions] = useState(DEFAULT_SUBJECTS)
  const [fileTooLarge, setFileTooLarge] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => new Date())
  const fileInputRef = useRef(null)
  const datePickerRef = useRef(null)

  useEffect(() => {
    if (suggestedDueDate) setDate(suggestedDueDate)
  }, [suggestedDueDate])

  useEffect(() => {
    if (!showDatePicker) return
    const onMouseDown = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [showDatePicker])

  const loadSubjects = () => {
    subjectsApi
      .list()
      .then(setSubjectOptions)
      .catch(() => {})
  }

  useEffect(() => {
    loadSubjects()
  }, [])

  useEffect(() => {
    const onSubjectsChanged = () => loadSubjects()
    window.addEventListener('grade-planner-subjects-changed', onSubjectsChanged)
    return () => window.removeEventListener('grade-planner-subjects-changed', onSubjectsChanged)
  }, [])

  const addMediaFromFiles = async (files) => {
    setFileTooLarge(false)
    let newImages = []
    let newVideos = []
    let newPdfs = []
    for (const file of Array.from(files)) {
      const kind = getMediaType(file)
      if (!kind) continue
      if (file.size > MAX_FILE_BYTES) {
        setFileTooLarge(true)
        continue
      }
      try {
        const url = await fileToDataUrl(file)
        if (kind === MEDIA_IMAGE) newImages.push(url)
        else if (kind === MEDIA_VIDEO) newVideos.push(url)
        else if (kind === MEDIA_PDF) newPdfs.push(url)
      } catch {
        // skip
      }
    }
    if (newImages.length) setImages((prev) => [...prev, ...newImages])
    if (newVideos.length) setVideos((prev) => [...prev, ...newVideos])
    if (newPdfs.length) setPdfs((prev) => [...prev, ...newPdfs])
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const item of items) {
      if (item.type.startsWith('image/')) files.push(item.getAsFile())
    }
    if (files.length) {
      e.preventDefault()
      addMediaFromFiles(files)
    }
  }

  const handleFileChange = (e) => {
    addMediaFromFiles(e.target.files || [])
    e.target.value = ''
  }

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index))
  const removeVideo = (index) => setVideos((prev) => prev.filter((_, i) => i !== index))
  const removePdf = (index) => setPdfs((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!subject.trim()) return
    const links = linksText
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    onSubmit({
      date: date,
      subject: subject.trim(),
      description: description.trim(),
      images: images.length ? images : undefined,
      videos: videos.length ? videos : undefined,
      pdfs: pdfs.length ? pdfs : undefined,
      links: links.length ? links : undefined,
    })
    setSubject('')
    setDescription('')
    setLinksText('')
    setImages([])
    setVideos([])
    setPdfs([])
    setDate(today())
  }

  const openDatePicker = () => {
    setViewMonth(date ? new Date(date + 'T12:00:00') : new Date())
    setShowDatePicker(true)
  }
  const pickerYear = viewMonth.getFullYear()
  const pickerMonth = viewMonth.getMonth()
  const pickerCells = getDaysInMonthForPicker(pickerYear, pickerMonth)
  const todayKey = today()

  return (
    <form className="assignment-form" onSubmit={handleSubmit}>
      <label className="assignment-form-date-label">
        <span>Due date</span>
        <div className="assignment-form-date-wrap" ref={datePickerRef}>
          <input type="hidden" name="date" value={date} required />
          <button
            type="button"
            className="assignment-form-date-trigger"
            onClick={openDatePicker}
            aria-haspopup="dialog"
            aria-expanded={showDatePicker}
            aria-label="Choose due date"
          >
            {formatDisplayDate(date)}
          </button>
          {showDatePicker && (
            <div className="assignment-form-date-picker" role="dialog" aria-label="Due date calendar">
              <div className="assignment-form-date-picker-header">
                <button type="button" className="assignment-form-date-picker-prev" onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1))} aria-label="Previous month">‹</button>
                <span className="assignment-form-date-picker-title">
                  {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" className="assignment-form-date-picker-next" onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1))} aria-label="Next month">›</button>
              </div>
              <div className="assignment-form-date-picker-weekdays">
                {WEEKDAYS.map((wd) => (
                  <span key={wd} className="assignment-form-date-picker-weekday">{wd}</span>
                ))}
              </div>
              <div className="assignment-form-date-picker-grid">
                {pickerCells.map((day, i) => {
                  if (day === null) {
                    return <div key={`e-${i}`} className="assignment-form-date-picker-cell assignment-form-date-picker-cell--empty" />
                  }
                  const key = dateKeyForPicker(pickerYear, pickerMonth, day)
                  const isToday = key === todayKey
                  const isSelected = key === date
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`assignment-form-date-picker-cell ${isToday ? 'assignment-form-date-picker-cell--today' : ''} ${isSelected ? 'assignment-form-date-picker-cell--selected' : ''}`}
                      onClick={() => { setDate(key); setShowDatePicker(false) }}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </label>
      <label>
        <span>Subject</span>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        >
          <option value="">Select subject...</option>
          {subjectOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Description</span>
        <textarea
          placeholder="Assignment title or details..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onPaste={handlePaste}
          rows={3}
        />
      </label>
      <label>
        <span>Link(s) <span className="assignment-form-optional">optional</span></span>
        <textarea
          placeholder="One link per line"
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          rows={2}
          className="assignment-form-links"
        />
      </label>
      <div className="assignment-form-media">
        <span className="assignment-form-media-label">Images, videos & PDFs</span>
        <div
          className="assignment-form-media-zone"
          onPaste={handlePaste}
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            multiple
            onChange={handleFileChange}
            className="assignment-form-media-input"
            aria-label="Add images, videos or PDFs"
          />
          <button
            type="button"
            className="assignment-form-media-trigger"
            onClick={() => fileInputRef.current?.click()}
          >
            + Add or paste images, videos or PDFs
          </button>
        </div>
        {fileTooLarge && (
          <p className="assignment-form-media-error">File is too large</p>
        )}
        {(images.length > 0 || videos.length > 0 || pdfs.length > 0) && (
          <div className="assignment-form-media-list">
            {images.map((url, i) => (
              <div key={`img-${i}`} className="assignment-form-media-item assignment-form-media-item--image">
                <img src={url} alt="" />
                <button type="button" className="assignment-form-media-remove" onClick={() => removeImage(i)} aria-label="Remove">×</button>
              </div>
            ))}
            {videos.map((url, i) => (
              <div key={`vid-${i}`} className="assignment-form-media-item assignment-form-media-item--video">
                <video src={url} muted preload="metadata" />
                <span className="assignment-form-media-badge">Video</span>
                <button type="button" className="assignment-form-media-remove" onClick={() => removeVideo(i)} aria-label="Remove">×</button>
              </div>
            ))}
            {pdfs.map((url, i) => (
              <div key={`pdf-${i}`} className="assignment-form-media-item assignment-form-media-item--pdf">
                <span className="assignment-form-media-pdf-icon">PDF</span>
                <button type="button" className="assignment-form-media-remove" onClick={() => removePdf(i)} aria-label="Remove">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={!subject.trim() || !description.trim()}>
        Add assignment
      </button>
    </form>
  )
}
