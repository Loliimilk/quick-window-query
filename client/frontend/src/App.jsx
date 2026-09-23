import { useState } from 'react'
import './App.css'
import './pages/pages.css'

import LeftSide from './left-side/left-side.jsx'

import Default from './pages/default/default.jsx'
import Directory from './pages/dictionary/dictionary.jsx'
import Note from './pages/note/note.jsx'
import Settings from './pages/settings/settings.jsx'
import {
  createManualNote,
  createPhraseNote,
  readNotes,
  writeNotes
} from './notes/noteStore.js'

function App() {
  const [activeTab, setActiveTab] = useState('logo')
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
    setActiveTab('note')
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

  const renderPage = () => {
    switch (activeTab) {
      case 'logo':      return <Default onAddPhraseToNotes={handleAddPhraseToNotes} />
      case 'directory': return <Directory />
      case 'note':      return (
        <Note
          notes={notes}
          onCreateNote={handleCreateNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onReorderNote={handleReorderNote}
        />
      )
      case 'settings':  return <Settings />
      default:          return <Default onAddPhraseToNotes={handleAddPhraseToNotes} />
    }
  }

  return (
    <div className='app'>
      <LeftSide activeTab={activeTab} onChange={setActiveTab} />
      <main className='content'>
        {renderPage()}
      </main>
    </div>
  )
}

export default App
