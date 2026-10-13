import { useState } from 'react'
import {
  createManualNote,
  createPhraseNote,
  readNotes,
  writeNotes
} from './noteStore.js'

export function useNotes() {
  const [notes, setNotes] = useState(() => readNotes())

  const commitNotes = (getNextNotes) => {
    setNotes(currentNotes => {
      const nextNotes = getNextNotes(currentNotes)

      writeNotes(nextNotes)
      return nextNotes
    })
  }

  const handleAddPhraseToNotes = (sentence) => {
    commitNotes(currentNotes => {
      const phraseNote = createPhraseNote(sentence)
      const existingNote = currentNotes.find(note =>
        note.source === phraseNote.source && note.sourceId === phraseNote.sourceId
      )

      if (existingNote) {
        return currentNotes.map(note =>
          note.id === existingNote.id
            ? {
              ...note,
              phrase: phraseNote.phrase,
              translation: phraseNote.translation,
              explanations: phraseNote.explanations,
              updatedAt: phraseNote.updatedAt
            }
            : note
        )
      }

      return [phraseNote, ...currentNotes]
    })
  }

  const handleCreateNote = (text) => {
    commitNotes(currentNotes => [createManualNote(text), ...currentNotes])
  }

  const handleUpdateNote = (id, patch) => {
    commitNotes(currentNotes =>
      currentNotes.map(note =>
        note.id === id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note
      )
    )
  }

  const handleDeleteNote = (id) => {
    commitNotes(currentNotes => currentNotes.filter(note => note.id !== id))
  }

  const handleReorderNote = (draggedId, targetId, placement = 'before') => {
    if (!draggedId || !targetId || draggedId === targetId) {
      return
    }

    commitNotes(currentNotes => {
      const draggedIndex = currentNotes.findIndex(note => note.id === draggedId)

      if (draggedIndex === -1) {
        return currentNotes
      }

      const draggedNote = currentNotes[draggedIndex]
      const notesWithoutDragged = currentNotes.filter(note => note.id !== draggedId)
      const targetIndex = notesWithoutDragged.findIndex(note => note.id === targetId)

      if (targetIndex === -1) {
        return currentNotes
      }

      const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex

      return [
        ...notesWithoutDragged.slice(0, insertIndex),
        draggedNote,
        ...notesWithoutDragged.slice(insertIndex)
      ]
    })
  }

  return {
    notes,
    handleAddPhraseToNotes,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleReorderNote
  }
}
