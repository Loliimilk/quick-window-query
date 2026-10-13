import { useState } from 'react'
import './App.css'
import './pages/pages.css'

import Sidebar from './components/Sidebar/Sidebar.jsx'

import CapturePage from './pages/capture/CapturePage.jsx'
import Dictionary from './pages/dictionary/dictionary.jsx'
import Note from './pages/note/note.jsx'
import Settings from './pages/settings/settings.jsx'
import { useNotes } from './features/notes/useNotes.js'

function App() {
  const [activeTab, setActiveTab] = useState('logo')
  const {
    notes,
    handleAddPhraseToNotes,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleReorderNote
  } = useNotes()

  const addPhraseToNotes = (sentence) => {
    handleAddPhraseToNotes(sentence)
    setActiveTab('note')
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'logo':      return <CapturePage onAddPhraseToNotes={addPhraseToNotes} />
      case 'directory': return <Dictionary />
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
      default:          return <CapturePage onAddPhraseToNotes={addPhraseToNotes} />
    }
  }

  return (
    <div className='app'>
      <Sidebar activeTab={activeTab} onChange={setActiveTab} />
      <main className='content'>
        {renderPage()}
      </main>
    </div>
  )
}

export default App
