const STORAGE_KEY = 'qwq.settings.v1'

const defaults = {
  translationMode: 'translator',
  llmLocation: 'local',
  localLlmModel: 'llama3.1',
  captureIntervalSeconds: 1
}

const ranges = {
  captureIntervalSeconds: [0, 10]
}

let captureSettingsSyncQueue = Promise.resolve()
let captureSettingsRevision = 0

const allowedValues = {
  translationMode: ['translator', 'llm'],
  llmLocation: ['local'],
  localLlmModel: ['llama3.1', 'qwen2.5', 'gemma2']
}

function clampNumber(value, fallback, range) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return fallback
  }

  const [min, max] = range
  const clamped = Math.min(max, Math.max(min, number))

  return Math.round(clamped)
}

function normalizeChoice(value, fallback, options) {
  return options.includes(value) ? value : fallback
}

function readLegacyCaptureInterval(settings) {
  let interval
  if (settings.captureIntervalSeconds != null) {
    interval = Number(settings.captureIntervalSeconds)
  } else if (settings.captureIntervalMs != null) {
    interval = Number(settings.captureIntervalMs) / 1000
  } else {
    return defaults.captureIntervalSeconds
  }

  // Previous releases only allowed positive sub-second values. Keep those at
  // one second after migration; zero now has the distinct meaning “no wait”.
  return interval > 0 && interval < 0.5 ? 1 : interval
}

export function normalizeSettings(value) {
  const settings = value && typeof value === 'object' ? value : {}

  return {
    translationMode: normalizeChoice(settings.translationMode, defaults.translationMode, allowedValues.translationMode),
    llmLocation: normalizeChoice(settings.llmLocation, defaults.llmLocation, allowedValues.llmLocation),
    localLlmModel: normalizeChoice(settings.localLlmModel, defaults.localLlmModel, allowedValues.localLlmModel),
    captureIntervalSeconds: clampNumber(
      readLegacyCaptureInterval(settings),
      defaults.captureIntervalSeconds,
      ranges.captureIntervalSeconds
    )
  }
}

export function readSettings() {
  if (typeof window === 'undefined') {
    return defaults
  }

  try {
    const rawSettings = window.localStorage.getItem(STORAGE_KEY)
    return normalizeSettings(rawSettings ? JSON.parse(rawSettings) : defaults)
  } catch {
    return defaults
  }
}

export function writeSettings(settings) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)))
  } catch {
    return
  }
}

export function resetSettings() {
  writeSettings(defaults)
  return defaults
}

export async function syncCaptureInterval(intervalSeconds) {
  const revision = ++captureSettingsRevision
  const request = captureSettingsSyncQueue.catch(() => {}).then(async () => {
    if (revision !== captureSettingsRevision) return null

    const response = await fetch('/api/capture/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interval_seconds: intervalSeconds })
    })

    if (!response.ok) {
      throw new Error(`Capture settings could not be applied (${response.status})`)
    }

    return response.json()
  })

  captureSettingsSyncQueue = request.catch(() => {})
  return request
}

export { defaults as defaultSettings, ranges as settingRanges }
