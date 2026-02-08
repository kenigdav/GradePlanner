import { useState, useRef, useEffect } from 'react'
import { subjectsApi } from './api'
import './AssignmentForm.css'

const today = () => new Date().toISOString().slice(0, 10)

const DEFAULT_SUBJECTS = [
  'Spanish', 'Science', 'Math', 'ELA', 'Social Studies', 'Music', 'PE', 'Engineering', 'Philosophy',
]

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function AssignmentForm({ onSubmit }) {
  const [date, setDate] = useState(today())
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState([])
  const [subjectOptions, setSubjectOptions] = useState(DEFAULT_SUBJECTS)
  const fileInputRef = useRef(null)

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

  const addImagesFromFiles = async (files) => {
    const newUrls = []
    for (const file of Array.from(files)) {
      try {
        const url = await fileToDataUrl(file)
        newUrls.push(url)
      } catch {
        // skip non-image files
      }
    }
    if (newUrls.length) setImages((prev) => [...prev, ...newUrls])
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
      addImagesFromFiles(files)
    }
  }

  const handleFileChange = (e) => {
    addImagesFromFiles(e.target.files || [])
    e.target.value = ''
  }

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!subject.trim()) return
    onSubmit({
      date: date,
      subject: subject.trim(),
      description: description.trim(),
      images: images.length ? images : undefined,
    })
    setSubject('')
    setDescription('')
    setImages([])
    setDate(today())
  }

  return (
    <form className="assignment-form" onSubmit={handleSubmit}>
      <label>
        <span>Due date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
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
      <div className="assignment-form-images">
        <span className="assignment-form-images-label">Images</span>
        <div
          className="assignment-form-images-zone"
          onPaste={handlePaste}
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="assignment-form-images-input"
            aria-label="Add images"
          />
          <button
            type="button"
            className="assignment-form-images-trigger"
            onClick={() => fileInputRef.current?.click()}
          >
            + Add or paste images
          </button>
        </div>
        {images.length > 0 && (
          <div className="assignment-form-images-list">
            {images.map((url, i) => (
              <div key={i} className="assignment-form-images-item">
                <img src={url} alt="" />
                <button type="button" className="assignment-form-images-remove" onClick={() => removeImage(i)} aria-label="Remove image">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="submit" className="btn btn-primary">
        Add assignment
      </button>
    </form>
  )
}
