import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  readSettings,
  resetSettings,
  settingRanges,
  writeSettings
} from '../../settings/settingsStore.js'
import './settings.css'

const interfaceLanguageOptions = [
  { value: 'ar', label: 'العربية', sortLabel: 'Arabic' },
  { value: 'zh', label: '中文', sortLabel: 'Chinese' },
  { value: 'en', label: 'English', sortLabel: 'English' },
  { value: 'fr', label: 'Français', sortLabel: 'French' },
  { value: 'de', label: 'Deutsch', sortLabel: 'German' },
  { value: 'hi', label: 'हिन्दी', sortLabel: 'Hindi' },
  { value: 'id', label: 'Indonesia', sortLabel: 'Indonesian' },
  { value: 'it', label: 'Italiano', sortLabel: 'Italian' },
  { value: 'ja', label: '日本語', sortLabel: 'Japanese' },
  { value: 'ko', label: '한국어', sortLabel: 'Korean' },
  { value: 'pl', label: 'Polski', sortLabel: 'Polish' },
  { value: 'pt', label: 'Português', sortLabel: 'Portuguese' },
  { value: 'ru', label: 'Русский', sortLabel: 'Russian' },
  { value: 'es', label: 'Español', sortLabel: 'Spanish' },
  { value: 'tr', label: 'Türkçe', sortLabel: 'Turkish' },
  { value: 'uk', label: 'Українська', sortLabel: 'Ukrainian' },
  { value: 'vi', label: 'Tiếng Việt', sortLabel: 'Vietnamese' }
]

const interfaceLanguages = [...interfaceLanguageOptions].sort((a, b) =>
  a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })
)

const localLlmModels = [
  { value: 'llama3.1', label: 'Llama 3.1' },
  { value: 'qwen2.5', label: 'Qwen 2.5' },
  { value: 'gemma2', label: 'Gemma 2' }
]

function Section({ title, eyebrow, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <div className="settings-section-body">
        {children}
      </div>
    </section>
  )
}

function Field({ label, value, children }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      {value && <strong>{value}</strong>}
      {children}
    </label>
  )
}

function LanguageSelect({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const selectedOption = options.find(option => option.value === value) ?? options[0]

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="settings-field settings-language-select" ref={rootRef}>
      <span>{label}</span>
      <button
        type="button"
        className="settings-language-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(value => !value)}
      >
        <span>{selectedOption.label}</span>
        <i aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="settings-language-menu" role="listbox">
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'active' : ''}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="settings-control">
      <span>{label}</span>
      <div className="settings-segmented" style={{ '--option-count': options.length }}>
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? 'active' : ''}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function NumberSetting({ label, value, range, unit, onChange }) {
  const [min, max] = range

  return (
    <div className="settings-number">
      <Field label={label} value={`${value}${unit}`}>
        <input
          type="range"
          min={min}
          max={max}
          step="0.1"
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
      </Field>
      <input
        type="number"
        min={min}
        max={max}
        step="0.1"
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function Settings() {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState(() => readSettings())
  const currentLanguage = i18n.language
  const currentLanguageLabel = interfaceLanguages.find(language => language.value === currentLanguage)?.label ?? currentLanguage
  const currentModelLabel = localLlmModels.find(model => model.value === settings.localLlmModel)?.label ?? settings.localLlmModel
  const summaryItems = [
    {
      label: t('pages.settings.summary.language'),
      value: currentLanguageLabel
    },
    {
      label: t('pages.settings.summary.translation'),
      value: t(`pages.settings.translationModes.${settings.translationMode}`)
    },
    {
      label: t('pages.settings.summary.llm'),
      value: settings.llmLocation === 'local'
        ? currentModelLabel
        : t('pages.settings.llmLocations.cloud')
    },
    {
      label: t('pages.settings.summary.capture'),
      value: `${settings.captureIntervalSeconds}s`
    }
  ]

  const commitSettings = (patch) => {
    setSettings(currentSettings => {
      const nextSettings = { ...currentSettings, ...patch }

      writeSettings(nextSettings)
      return nextSettings
    })
  }

  const handleReset = () => {
    setSettings(resetSettings())
  }

  return (
    <div className="pages settings-page">
      <div className="settings-layout">
        <header className="settings-hero">
          <div>
            <h1>{t('pages.settings.title')}</h1>
            <p>{t('pages.settings.status')}</p>
          </div>
          <button type="button" className="settings-reset" onClick={handleReset}>
            {t('pages.settings.reset')}
          </button>
        </header>

        <div className="settings-summary">
          {summaryItems.map(item => (
            <div key={item.label} className="settings-summary-item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="settings-grid settings-grid-compact">
          <Section
            eyebrow={t('pages.settings.sections.interface.eyebrow')}
            title={t('pages.settings.sections.interface.title')}
          >
            <LanguageSelect
              label={t('pages.settings.interfaceLanguage')}
              value={currentLanguage}
              options={interfaceLanguages}
              onChange={language => i18n.changeLanguage(language)}
            />
          </Section>

          <Section
            eyebrow={t('pages.settings.sections.translation.eyebrow')}
            title={t('pages.settings.sections.translation.title')}
          >
            <SegmentedControl
              label={t('pages.settings.translationMode')}
              value={settings.translationMode}
              options={[
                { value: 'translator', label: t('pages.settings.translationModes.translator') },
                { value: 'llm', label: t('pages.settings.translationModes.llm') }
              ]}
              onChange={translationMode => commitSettings({ translationMode })}
            />
          </Section>

          <Section
            eyebrow={t('pages.settings.sections.llm.eyebrow')}
            title={t('pages.settings.sections.llm.title')}
          >
            <SegmentedControl
              label={t('pages.settings.llmLocation')}
              value={settings.llmLocation}
              options={[
                { value: 'local', label: t('pages.settings.llmLocations.local') },
                { value: 'cloud', label: t('pages.settings.llmLocations.cloud') }
              ]}
              onChange={llmLocation => commitSettings({ llmLocation })}
            />
            {settings.llmLocation === 'local' ? (
              <SegmentedControl
                label={t('pages.settings.localModel')}
                value={settings.localLlmModel}
                options={localLlmModels}
                onChange={localLlmModel => commitSettings({ localLlmModel })}
              />
            ) : (
              <div className="settings-cloud-note">
                <span>{t('pages.settings.cloudAutomaticBadge')}</span>
                <p>{t('pages.settings.cloudAutomatic')}</p>
              </div>
            )}
          </Section>

          <Section
            eyebrow={t('pages.settings.sections.capture.eyebrow')}
            title={t('pages.settings.sections.capture.title')}
          >
            <NumberSetting
              label={t('pages.settings.captureInterval')}
              value={settings.captureIntervalSeconds}
              range={settingRanges.captureIntervalSeconds}
              unit="s"
              onChange={captureIntervalSeconds => commitSettings({ captureIntervalSeconds })}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}

export default Settings
