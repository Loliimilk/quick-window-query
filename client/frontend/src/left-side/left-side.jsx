import { useTranslation } from 'react-i18next'
import './left-side.css'

import noteIcon from '../assets/note.svg'
import directoryIcon from '../assets/directory.svg'
import settingsIcon from '../assets/setting.svg'

const tabs = [
  { id: 'logo', icon: null, label: 'QwQ', translationKey: 'navigation.home' },
  { id: 'note', icon: noteIcon, translationKey: 'navigation.notes' },
  { id: 'directory', icon: directoryIcon, translationKey: 'navigation.dictionary' },
  { id: 'settings', icon: settingsIcon, translationKey: 'navigation.settings' },
]

function LeftSide({ activeTab, onChange }) {
  const { t } = useTranslation()

  return (
    <div className="leftSide">
      {tabs.map(tab => {
        const label = tab.translationKey ? t(tab.translationKey) : tab.label

        return (
          <button
            key={tab.id}
            type="button"
            className={`buttonSideElements ${activeTab === tab.id ? 'active' : ''}`}
            id={`button${tab.id}`}
            onClick={() => onChange?.(tab.id)}
            aria-label={label}
            title={label}
          >
            {tab.icon ? (
              <img src={tab.icon} alt="" aria-hidden="true" className="imgButton" />
            ) : (
              tab.label
            )}
          </button>
        )
      })}
    </div>
  )
}

export default LeftSide
