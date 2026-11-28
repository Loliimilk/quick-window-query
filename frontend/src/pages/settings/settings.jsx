import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  readSettings,
  settingRanges,
  syncCaptureInterval,
  writeSettings
} from '../../features/settings/settingsStore.js'
import './settings.css'

const HARDWARE_CACHE_KEY = 'qwq.hardware-check.v4'
const MINIMUM_HOST_MEMORY_GIB = 3.5
const MINIMUM_CPU_THREADS = 4
const SUITABLE_CPU_THREADS = 8
let hardwareSnapshotRequest = null
let hardwareSnapshotForSession = null
let hardwareSnapshotError = null

function requestHardwareSnapshot(force = false) {
  if (hardwareSnapshotRequest) {
    const request = hardwareSnapshotRequest
    return request.finally(() => {
      if (hardwareSnapshotRequest === request) hardwareSnapshotRequest = null
    })
  }

  if (!force && hardwareSnapshotForSession) {
    return Promise.resolve(hardwareSnapshotForSession)
  }

  if (!hardwareSnapshotRequest) {
    hardwareSnapshotRequest = (async () => {
      try {
        const response = await fetch('/api/system-info', { cache: 'no-store' })
        if (!response.ok) throw new Error('System info endpoint unavailable')
        const data = await response.json()
        const checkedAt = Date.now()
        hardwareSnapshotForSession = { data, checkedAt }
        hardwareSnapshotError = null
        writeHardwareCache(data, checkedAt)
        return hardwareSnapshotForSession
      } catch (error) {
        hardwareSnapshotError = error
        throw error
      }
    })()
  }

  const request = hardwareSnapshotRequest
  return request.finally(() => {
    if (hardwareSnapshotRequest === request) hardwareSnapshotRequest = null
  })
}

const interfaceLanguageOptions = [
  { value: 'ar', label: 'العربية' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'uk', label: 'Українська' },
  { value: 'vi', label: 'Tiếng Việt' }
]

const interfaceLanguages = [...interfaceLanguageOptions].sort((a, b) =>
  a.label.localeCompare(b.label, 'en', { sensitivity: 'base' })
)

// Memory estimates assume a 4-bit local model and leave some memory for the OS.
const localLlmModels = [
  { value: 'qwen2.5', label: 'Qwen 2.5', size: '7B', minMemoryGiB: 5.5, idealMemoryGiB: 8, rank: 1 },
  { value: 'llama3.1', label: 'Llama 3.1', size: '8B', minMemoryGiB: 6.5, idealMemoryGiB: 9, rank: 2 },
  { value: 'gemma2', label: 'Gemma 2', size: '9B', minMemoryGiB: 7.5, idealMemoryGiB: 10, rank: 3 }
]

function readHardwareCache() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(HARDWARE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    if (!cache?.data || !Number.isFinite(cache.checkedAt)) return null
    return cache
  } catch {
    return null
  }
}

function writeHardwareCache(data, checkedAt) {
  try {
    window.localStorage.setItem(HARDWARE_CACHE_KEY, JSON.stringify({ data, checkedAt }))
  } catch {
    return
  }
}

function getModelMemoryCapacity(hardware) {
  if (!hardware) return null

  const ram = Number(hardware.total_ram_gib)
  const nvidiaGPUs = Array.isArray(hardware.nvidia_gpus) ? hardware.nvidia_gpus : []
  const vram = nvidiaGPUs
    .filter(gpu => gpu && typeof gpu === 'object')
    .map(gpu => Number(gpu.total_vram_gib))
    .filter(Number.isFinite)
  const gpuCapacity = vram.length ? Math.max(...vram) : 0
  const capacity = Math.max(Number.isFinite(ram) ? ram : 0, gpuCapacity)

  return capacity > 0 ? capacity : null
}

function getModelFits(hardware) {
  const capacity = getModelMemoryCapacity(hardware)
  if (capacity == null) return []
  const hostRAM = Number(hardware.total_ram_gib)
  const enoughHostRAM = Number.isFinite(hostRAM) && hostRAM >= MINIMUM_HOST_MEMORY_GIB
  const cpuThreads = Number(hardware.cpu_threads)
  const cpuThreadsKnown = Number.isFinite(cpuThreads) && cpuThreads > 0
  const nvidiaGPUs = Array.isArray(hardware.nvidia_gpus) ? hardware.nvidia_gpus : []
  const gpuVRAM = nvidiaGPUs
    .filter(gpu => gpu && typeof gpu === 'object')
    .map(gpu => Number(gpu.total_vram_gib))
    .filter(Number.isFinite)
  const bestGPUCapacity = gpuVRAM.length ? Math.max(...gpuVRAM) : 0

  return localLlmModels.map(model => {
    let fit = 'insufficient'
    const enoughMemory = enoughHostRAM && capacity >= model.minMemoryGiB
    const strongCompute = (cpuThreadsKnown && cpuThreads >= SUITABLE_CPU_THREADS)
      || bestGPUCapacity >= model.idealMemoryGiB
    const workableCompute = !cpuThreadsKnown
      || cpuThreads >= MINIMUM_CPU_THREADS
      || bestGPUCapacity >= model.minMemoryGiB

    if (enoughMemory && capacity >= model.idealMemoryGiB && strongCompute) fit = 'ideal'
    else if (enoughMemory && workableCompute) fit = 'borderline'
    return { ...model, fit }
  })
}

function getRecommendedModel(hardware) {
  const fits = getModelFits(hardware).filter(model => model.fit !== 'insufficient')
  const ideal = fits.filter(model => model.fit === 'ideal')
  return [...(ideal.length ? ideal : fits)].sort((a, b) => b.rank - a.rank)[0] ?? null
}

function SettingsPreference({ label, children, className = '' }) {
  return (
    <div className={`settings-preference-row ${className}`.trim()}>
      <span className="settings-preference-label">{label}</span>
      <div className="settings-preference-control">{children}</div>
    </div>
  )
}

function LanguageSelect({ label, value, options, onChange }) {
  return (
    <div className="settings-language-select">
      <select
        className="settings-language-input"
        aria-label={label}
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="settings-segmented" role="group" aria-label={label} style={{ '--option-count': options.length }}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'active' : ''}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function CaptureIntervalControl({ label, value, onChange, syncState, t }) {
  const [min, max] = settingRanges.captureIntervalSeconds
  const displayValue = value === 0
    ? t('pages.settings.captureMaxSpeed')
    : t('pages.settings.captureSeconds', { count: value })

  return (
    <div className="settings-capture-control">
      <div className="settings-capture-track">
        <input
          type="range"
          min={min}
          max={max}
          step="1"
          value={value}
          aria-label={label}
          aria-valuetext={displayValue}
          style={{ '--range-fill': `${(value - min) / (max - min) * 100}%` }}
          onChange={event => onChange(Number(event.target.value))}
        />
        <output className="settings-capture-value">{displayValue}</output>
      </div>
      <span className="settings-range-labels">
        <span>0</span>
        <span>{t('pages.settings.captureSeconds', { count: max })}</span>
      </span>
      {value === 0 && <p className="settings-help">{t('pages.settings.captureMaxSpeedHint')}</p>}
      {syncState === 'error' && (
        <p className="settings-inline-error" role="status">{t('pages.settings.captureSyncError')}</p>
      )}
    </div>
  )
}

function HardwareSummary({ hardware, checkedAt, scanState, scanMessage, onScan, locale, t }) {
  const lastCheck = checkedAt
    ? new Date(checkedAt).toLocaleString(locale)
    : t('pages.settings.hardware.neverChecked')
  const nvidiaGPUs = Array.isArray(hardware?.nvidia_gpus)
    ? hardware.nvidia_gpus.filter(gpu => gpu && typeof gpu === 'object')
    : []
  const graphicsCards = Array.isArray(hardware?.gpus) ? hardware.gpus : []
  const nvidiaGpu = [...nvidiaGPUs].sort((a, b) => Number(b.total_vram_gib) - Number(a.total_vram_gib))[0]
  const gpuName = nvidiaGpu?.name ?? graphicsCards[0]
  const cpuSummary = hardware?.cpu
    ? [
        hardware.cpu,
        hardware.cpu_cores ? `${hardware.cpu_cores} ${t('pages.settings.hardware.cores')}` : null,
        hardware.cpu_threads ? `${hardware.cpu_threads} ${t('pages.settings.hardware.threads')}` : null
      ].filter(Boolean).join(' · ')
    : t('pages.settings.hardware.unknown')

  return (
    <>
    <details className="settings-hardware">
      <summary>
        <span>{t('pages.settings.hardware.title')}</span>
        <span
          className={`settings-hardware-preview ${scanState === 'error' ? 'is-error' : ''}`}
          role={scanState === 'error' || scanState === 'scanning' ? 'status' : undefined}
        >
          {scanState === 'error'
            ? t('pages.settings.hardware.summaryError')
            : scanState === 'scanning'
              ? t('pages.settings.hardware.summaryScanning')
              : hardware
                ? `${hardware.total_ram_gib} ${t('pages.settings.gib')} ${t('pages.settings.hardware.ramShort')}`
                : ''}
        </span>
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
      </summary>
      <div className="settings-hardware-details">
        {scanState === 'error' && (
          <div className={`settings-hardware-state ${hardware ? 'is-warning' : 'is-error'}`} role="status">
            {t(`pages.settings.hardware.${hardware ? 'staleData' : 'error'}`)}
          </div>
        )}
        {hardware ? (
          <>
          <dl className="settings-hardware-facts">
            <div>
              <dt>{t('pages.settings.hardware.ram')}</dt>
              <dd>
                {hardware.total_ram_gib} {t('pages.settings.gib')}
              </dd>
            </div>
            <div>
              <dt>{t('pages.settings.hardware.gpu')}</dt>
              <dd>{gpuName || t('pages.settings.hardware.unknown')}</dd>
            </div>
            <div>
              <dt>{t('pages.settings.hardware.cpu')}</dt>
              <dd>{cpuSummary}</dd>
            </div>
            {nvidiaGpu && (
              <div>
                <dt>{t('pages.settings.hardware.totalVram')}</dt>
                <dd>{nvidiaGpu.total_vram_gib} {t('pages.settings.gib')}</dd>
              </div>
            )}
          </dl>
          <p className="settings-help">{t('pages.settings.hardware.estimateNote')}</p>
          <p className="settings-help">{t('pages.settings.hardware.lastChecked', { date: lastCheck })}</p>
          </>
        ) : scanState !== 'error' && scanState !== 'scanning' ? (
          <div className="settings-hardware-state">{t('pages.settings.hardware.notChecked')}</div>
        ) : null}
        {scanState !== 'error' && (
          <button
            type="button"
            className="settings-action-button settings-hardware-refresh"
            disabled={scanState === 'scanning'}
            onClick={() => onScan(true)}
          >
            {t(`pages.settings.hardware.${scanState === 'scanning' ? 'scanning' : 'chooseButton'}`)}
          </button>
        )}
        {scanMessage && <p className="settings-scan-message" role="status">{scanMessage}</p>}
      </div>
    </details>
    {scanState === 'error' && (
      <button type="button" className="settings-action-button settings-hardware-retry" onClick={() => onScan(true)}>
        {t('pages.settings.hardware.retry')}
      </button>
    )}
    </>
  )
}

function LocalModelPicker({ value, hardware, checkedAt, scanState, onChange, onScan, scanMessage, locale, t }) {
  const modelButtonRefs = useRef({})
  const fits = getModelFits(hardware)
  const selectableModels = localLlmModels
  const tabStopModel = selectableModels.find(model => model.value === value) ?? selectableModels[0]

  const handleModelKeyDown = event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    if (!selectableModels.length) return

    event.preventDefault()
    const currentIndex = selectableModels.findIndex(model => model.value === value)
    const startIndex = currentIndex >= 0 ? currentIndex : 0
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? selectableModels.length - 1
        : (startIndex + direction + selectableModels.length) % selectableModels.length
    const nextModel = selectableModels[nextIndex]
    onChange(nextModel.value)
    modelButtonRefs.current[nextModel.value]?.focus()
  }

  return (
    <div className="settings-model-picker">
      <div className="settings-model-heading">
        <h2>{t('pages.settings.localModel')}</h2>
        <p className="settings-runtime-note">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" /><path d="M10 9.2v4.3m0-7.1h.01" /></svg>
          <span>{t('pages.settings.hardware.integrationNote')}</span>
        </p>
      </div>
      <div
        className="settings-model-list"
        role="radiogroup"
        aria-label={t('pages.settings.localModel')}
        onKeyDown={handleModelKeyDown}
      >
        {localLlmModels.map(model => {
          const modelFit = fits.find(item => item.value === model.value)
          const status = modelFit?.fit ?? 'unchecked'
          return (
            <button
              key={model.value}
              type="button"
              className={`settings-model-card ${value === model.value ? 'is-selected' : ''} is-${status}`}
              role="radio"
              aria-checked={value === model.value}
              tabIndex={tabStopModel?.value === model.value ? 0 : -1}
              ref={node => { modelButtonRefs.current[model.value] = node }}
              onClick={() => onChange(model.value)}
            >
              <span className="settings-radio-mark" aria-hidden="true" />
              <span className="settings-model-name">
                <strong>{model.label} <span className="settings-model-size">{model.size}</span></strong>
              </span>
              <span className={`settings-fit-badge is-${status}`}>
                {t(`pages.settings.hardware.fit.${status}`)}
              </span>
            </button>
          )
        })}
      </div>
      <HardwareSummary
        hardware={hardware}
        checkedAt={checkedAt}
        scanState={scanState}
        scanMessage={scanMessage}
        onScan={onScan}
        locale={locale}
        t={t}
      />
    </div>
  )
}

function CloudPlansModal({ onClose, t }) {
  const modalRef = useRef(null)
  const plans = ['starter', 'plus', 'max']

  useEffect(() => {
    const previousFocus = document.activeElement
    const dialog = modalRef.current
    dialog.showModal()
    return () => {
      dialog.close()
      previousFocus?.focus?.()
    }
  }, [])

  return (
    <dialog
      className="settings-cloud-modal"
      aria-labelledby="cloud-plans-title"
      aria-describedby="cloud-plans-description"
      ref={modalRef}
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="settings-cloud-content">
        <header className="settings-modal-head">
          <div>
            <h2 id="cloud-plans-title">QwQ <span>{t('pages.settings.cloudPlans.title')}</span></h2>
            <p id="cloud-plans-description">{t('pages.settings.cloudPlans.sameModel')}</p>
          </div>
          <button type="button" className="settings-modal-close" onClick={onClose} aria-label={t('pages.settings.cloudPlans.close')} autoFocus>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <p className="settings-cloud-notice">{t('pages.settings.cloudPlans.disclaimer')}</p>
        <div className="settings-plans-list">
          {plans.map(plan => (
            <article key={plan} className={`settings-plan-card settings-plan-card--${plan}`}>
              <h3>{t(`pages.settings.cloudPlans.plans.${plan}.name`)}</h3>
              <p className="settings-plan-audience">{t(`pages.settings.cloudPlans.plans.${plan}.audience`)}</p>
              <p className="settings-plan-price">{t('pages.settings.cloudPlans.pricePending')}</p>
              <p className="settings-plan-volume">{t(`pages.settings.cloudPlans.plans.${plan}.volume`)}</p>
            </article>
          ))}
        </div>
        <footer className="settings-cloud-footer">
          <div>
            <strong>{t('pages.settings.cloudPlans.freeTitle')}</strong>
            <p>{t('pages.settings.cloudPlans.freeDescription')}</p>
          </div>
          <button type="button" className="settings-free-button" onClick={onClose}>{t('pages.settings.cloudPlans.stayFree')}</button>
        </footer>
      </div>
    </dialog>
  )
}

function Settings() {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState(() => readSettings())
  const [cachedHardware] = useState(readHardwareCache)
  const [hardware, setHardware] = useState(() => cachedHardware?.data ?? null)
  const [hardwareCheckedAt, setHardwareCheckedAt] = useState(() => cachedHardware?.checkedAt ?? null)
  const [scanState, setScanState] = useState('scanning')
  const [scanMessage, setScanMessage] = useState('')
  const [captureSyncState, setCaptureSyncState] = useState('ready')
  const [cloudModalOpen, setCloudModalOpen] = useState(false)
  const captureSyncRevision = useRef(0)
  const currentLanguage = i18n.language

  const applyCaptureInterval = useCallback(intervalSeconds => {
    const revision = ++captureSyncRevision.current
    setCaptureSyncState('syncing')
    syncCaptureInterval(intervalSeconds)
      .then(() => {
        if (captureSyncRevision.current === revision) setCaptureSyncState('ready')
      })
      .catch(() => {
        if (captureSyncRevision.current === revision) setCaptureSyncState('error')
      })
  }, [])

  const commitSettings = useCallback(patch => {
    setSettings(currentSettings => {
      const nextSettings = { ...currentSettings, ...patch }
      writeSettings(nextSettings)
      return nextSettings
    })

    if (patch.captureIntervalSeconds != null) {
      applyCaptureInterval(patch.captureIntervalSeconds)
    }
  }, [applyCaptureInterval])

  const scanHardware = useCallback(async (applyRecommendation = false) => {
    setScanState('scanning')
    setScanMessage('')

    try {
      const { data, checkedAt } = await requestHardwareSnapshot(true)
      setHardware(data)
      setHardwareCheckedAt(checkedAt)
      setScanState('ready')

      const bestModel = getRecommendedModel(data)
      if (applyRecommendation && bestModel) {
        commitSettings({ localLlmModel: bestModel.value })
        setScanMessage(t('pages.settings.hardware.applied', { model: bestModel.label }))
      } else if (applyRecommendation) {
        setScanMessage(t('pages.settings.hardware.noModelFitsHint'))
      } else {
        setScanMessage(t('pages.settings.hardware.scanComplete'))
      }
    } catch {
      setScanState('error')
      setScanMessage(t('pages.settings.hardware.error'))
    }
  }, [commitSettings, t])

  useEffect(() => {
    let cancelled = false
    const loadHardware = async () => {
      try {
        const { data, checkedAt } = await requestHardwareSnapshot()
        if (cancelled) return
        setHardware(data)
        setHardwareCheckedAt(checkedAt)
        setScanState(hardwareSnapshotError ? 'error' : 'ready')
      } catch {
        if (!cancelled) setScanState('error')
      }
    }

    loadHardware()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="pages settings-page">
      <div className="settings-layout">
        <header className="settings-hero">
          <h1>{t('pages.settings.title')}</h1>
          <p>{t('pages.settings.subtitle')}</p>
        </header>

        <div className="settings-workspace">
          <section className="settings-group settings-preferences" aria-labelledby="settings-general-title">
            <h2 className="settings-group-heading" id="settings-general-title">{t('pages.settings.generalSection')}</h2>
            <SettingsPreference label={t('pages.settings.interfaceLanguage')}>
              <LanguageSelect
                label={t('pages.settings.interfaceLanguage')}
                value={currentLanguage}
                options={interfaceLanguages}
                onChange={language => i18n.changeLanguage(language)}
              />
            </SettingsPreference>
            <SettingsPreference label={t('pages.settings.translationMode')}>
              <SegmentedControl
                label={t('pages.settings.translationMode')}
                value={settings.translationMode}
                options={[
                  { value: 'translator', label: t('pages.settings.translationModes.translator') },
                  { value: 'llm', label: t('pages.settings.translationModes.llm') }
                ]}
                onChange={translationMode => commitSettings({ translationMode })}
              />
            </SettingsPreference>
            <SettingsPreference label={t('pages.settings.captureInterval')} className="is-interval">
              <CaptureIntervalControl
                label={t('pages.settings.captureInterval')}
                value={settings.captureIntervalSeconds}
                syncState={captureSyncState}
                onChange={captureIntervalSeconds => commitSettings({ captureIntervalSeconds })}
                t={t}
              />
            </SettingsPreference>
          </section>
          <section className="settings-group settings-processing" aria-label={t('pages.settings.localModel')}>
            <LocalModelPicker
              value={settings.localLlmModel}
              hardware={hardware}
              checkedAt={hardwareCheckedAt}
              scanState={scanState}
              onChange={localLlmModel => commitSettings({ localLlmModel })}
              onScan={scanHardware}
              scanMessage={scanMessage}
              locale={currentLanguage}
              t={t}
            />
          </section>
        </div>
        <section className="settings-cloud-account" aria-labelledby="settings-cloud-title">
          <div className="settings-cloud-information">
            <svg className="settings-cloud-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M10.5 29.5h19a6 6 0 0 0 .2-12 10 10 0 0 0-19.2 2.1 5 5 0 0 0 0 9.9Z" /></svg>
            <div className="settings-cloud-copy">
              <h2 id="settings-cloud-title">{t('pages.settings.cloudPlans.title')}</h2>
              <p>{t('pages.settings.cloudPlans.accountDescription')}</p>
            </div>
          </div>
          <button type="button" className="settings-cloud-open" onClick={() => setCloudModalOpen(true)} aria-haspopup="dialog">
            {t('pages.settings.cloudPlans.viewPlans')}
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg>
          </button>
        </section>
      </div>
      {cloudModalOpen && <CloudPlansModal onClose={() => setCloudModalOpen(false)} t={t} />}
    </div>
  )
}

export default Settings
