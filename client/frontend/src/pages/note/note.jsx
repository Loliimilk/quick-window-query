import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGrammarCategory } from '../../grammar/categories.js'
import './note.css'

function formatDate(value, language) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function NoteSentenceText({ note, hoveredExplanationId, onHoverExplanation }) {
  const partData = {}

  for (const explanation of note.explanations ?? []) {
    const meta = getGrammarCategory(explanation.category)

    for (const ref of explanation.refs ?? []) {
      if (!partData[ref]) {
        partData[ref] = {
          id: explanation.id,
          color: meta.color,
          category: explanation.category
        }
      }
    }
  }

  if (!note.parts?.length) {
    return note.phrase
  }

  return note.parts.map((part, index) => {
    const highlight = partData[index]

    if (!highlight) {
      return <span key={index}>{part.text}</span>
    }

    return (
      <span
        key={index}
        className={`note-colored ${hoveredExplanationId === highlight.id ? 'hovered' : ''}`}
        data-category={highlight.category}
        onMouseEnter={() => onHoverExplanation(highlight.id)}
        onMouseLeave={() => onHoverExplanation(null)}
        style={{ '--accent-color': highlight.color }}
      >
        {part.text}
      </span>
    )
  })
}

function Note({
  notes = [],
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onReorderNote
}) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState('')
  const [draggedNoteId, setDraggedNoteId] = useState(null)
  const [dragOverNote, setDragOverNote] = useState(null)
  const [hoveredExplanation, setHoveredExplanation] = useState(null)
  const noteRefs = useRef(new Map())
  const previousNoteRects = useRef(null)
  const trimmedDraft = draft.trim()

  const setNoteRef = (id, node) => {
    if (node) {
      noteRefs.current.set(id, node)
      return
    }

    noteRefs.current.delete(id)
  }

  const captureNotePositions = () => {
    const nextRects = new Map()

    for (const [id, node] of noteRefs.current) {
      nextRects.set(id, node.getBoundingClientRect())
    }

    previousNoteRects.current = nextRects
  }

  useLayoutEffect(() => {
    const previousRects = previousNoteRects.current

    if (!previousRects) {
      return
    }

    previousNoteRects.current = null

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    for (const [id, node] of noteRefs.current) {
      const previousRect = previousRects.get(id)

      if (!previousRect) {
        continue
      }

      const nextRect = node.getBoundingClientRect()
      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        continue
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' }
        ],
        {
          duration: 280,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        }
      )
    }
  }, [notes])

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!trimmedDraft) {
      return
    }

    onCreateNote?.(trimmedDraft)
    setDraft('')
  }

  return (
    <div className="pages notes-page">
      <div className="notes-layout">
        <header className="notes-header">
          <div>
            <h1>{t('pages.notes.title')}</h1>
            <p>{t('pages.notes.count', { count: notes.length })}</p>
          </div>
        </header>

        <form className="note-composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="new-note">
            {t('pages.notes.newNote')}
          </label>
          <textarea
            id="new-note"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={t('pages.notes.newNotePlaceholder')}
            rows={3}
          />
          <button type="submit" disabled={!trimmedDraft}>
            {t('pages.notes.addButton')}
          </button>
        </form>

        {notes.length === 0 ? (
          <div className="notes-empty">
            <h2>{t('pages.notes.emptyTitle')}</h2>
            <p>{t('pages.notes.emptyDescription')}</p>
          </div>
        ) : (
          <div className="notes-list">
            {notes.map(note => {
              const dateLabel = formatDate(note.updatedAt ?? note.createdAt, i18n.resolvedLanguage)
              const isDragOver = draggedNoteId && draggedNoteId !== note.id && dragOverNote?.id === note.id
              const dragPlacement = isDragOver ? dragOverNote.placement : null
              const hoveredExplanationId = hoveredExplanation?.noteId === note.id
                ? hoveredExplanation.explanationId
                : null

              return (
                <article
                  key={note.id}
                  ref={node => setNoteRef(note.id, node)}
                  className={`note-card ${note.phrase ? 'has-phrase' : 'is-manual'} ${isDragOver ? `is-drag-${dragPlacement}` : ''}`}
                  onDragOver={event => {
                    if (!draggedNoteId || draggedNoteId === note.id) {
                      return
                    }

                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'

                    setDragOverNote({ id: note.id, placement })
                  }}
                  onDragLeave={() => {
                    if (dragOverNote?.id === note.id) {
                      setDragOverNote(null)
                    }
                  }}
                  onDrop={event => {
                    event.preventDefault()
                    captureNotePositions()
                    onReorderNote?.(draggedNoteId, note.id, dragPlacement ?? 'before')
                    setDraggedNoteId(null)
                    setDragOverNote(null)
                  }}
                >
                  <div className="note-main">
                    <div
                      className="note-card-top"
                      draggable
                      title={t('pages.notes.dragHandle')}
                      onDragStart={() => {
                        setDraggedNoteId(note.id)
                        setDragOverNote(null)
                      }}
                      onDragEnd={() => {
                        setDraggedNoteId(null)
                        setDragOverNote(null)
                      }}
                    >
                      <div className="note-card-meta">
                        <span className="note-grip" aria-hidden="true" />
                        <span className="note-type">
                          {note.phrase ? t('pages.notes.phraseLabel') : t('pages.notes.noteLabel')}
                        </span>
                      </div>
                      {dateLabel && <time dateTime={note.updatedAt}>{dateLabel}</time>}
                    </div>

                    {note.phrase && (
                      <div className="note-phrase-block">
                        <blockquote>
                          <NoteSentenceText
                            note={note}
                            hoveredExplanationId={hoveredExplanationId}
                            onHoverExplanation={explanationId => {
                              setHoveredExplanation(explanationId ? { noteId: note.id, explanationId } : null)
                            }}
                          />
                        </blockquote>
                        {note.translation && <p>{note.translation}</p>}
                      </div>
                    )}

                    <label className="sr-only" htmlFor={`note-text-${note.id}`}>
                      {t('pages.notes.noteText')}
                    </label>
                    <textarea
                      id={`note-text-${note.id}`}
                      value={note.text}
                      onChange={event => onUpdateNote?.(note.id, { text: event.target.value })}
                      placeholder={t('pages.notes.notePlaceholder')}
                      rows={note.phrase ? 3 : 5}
                    />

                    <div className="note-card-actions">
                      <button type="button" onClick={() => onDeleteNote?.(note.id)}>
                        {t('pages.notes.deleteButton')}
                      </button>
                    </div>
                  </div>

                  {(note.explanations?.length ?? 0) > 0 && (
                    <div className="note-explanations">
                      {note.explanations.map(explanation => {
                        const meta = getGrammarCategory(explanation.category)

                        return (
                          <div
                            key={explanation.id}
                            className={`note-explanation ${hoveredExplanationId === explanation.id ? 'active' : ''}`}
                            onMouseEnter={() => {
                              setHoveredExplanation({ noteId: note.id, explanationId: explanation.id })
                            }}
                            onMouseLeave={() => {
                              setHoveredExplanation(null)
                            }}
                            style={{ '--accent-color': meta.color }}
                          >
                            <p>{t(meta.label)}</p>
                            <span>{explanation.description}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Note
