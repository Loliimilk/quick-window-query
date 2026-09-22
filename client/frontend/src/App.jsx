import { useState } from 'react'
import './App.css'
import './pages/pages.css'

import LeftSide from './left-side/left-side.jsx'

import Default from './pages/default/default.jsx'
import Directory from './pages/dictionary/dictionary.jsx'
import Note from './pages/note/note.jsx'
import Settings from './pages/settings/settings.jsx'

function App() {
  const [activeTab, setActiveTab] = useState('logo')

  const renderPage = () => {
    switch (activeTab) {
      case 'logo':      return <Default />
      case 'directory': return <Directory />
      case 'note':      return <Note />
      case 'settings':  return <Settings />
      default:          return <Default />
    }
  }

  return (
    <div className='app'>
      <LeftSide  activeTab={activeTab} onchange={setActiveTab} />
      <main className='content'>
        {renderPage()}
      </main>
    </div>
  )
}

export default App
