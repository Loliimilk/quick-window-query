import './left-side.css'

import noteIcon from '../assets/note.svg'
import directoryIcon from '../assets/directory.svg'
import settingsIcon from '../assets/setting.svg'

const tabs = [
    {id: 'logo', icon: null, label: 'QwQ'},
    {id: 'note', icon: noteIcon},
    {id: 'directory', icon: directoryIcon},
    {id: 'settings', icon: settingsIcon},
]

function LeftSide({ activeTab, onchange }) {
    return (
        <div className="leftSide">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`buttonSideElements ${activeTab === tab.id ? 'active' : ''}`}
                    id={'button' + tab.id}
                    onClick={() => onchange?.(tab.id)}
                >
                    {tab.icon ? <img src={tab.icon} alt={tab.id} className={'imgButton'}></img> : tab.label}
                </button>
            ))}
        </div>
    )
}

export default LeftSide;