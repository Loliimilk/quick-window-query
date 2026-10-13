const STORAGE_KEY = 'qwq.settings.v1'

const defaults = {
  translationMode: 'translator',
  llmLocation: 'local',
  localLlmModel: 'llama3.1',
  captureIntervalSeconds: 1
}

const ranges = {
  captureIntervalSeconds: [0.1, 30]
}

const allowedValues = {
  translationMode: ['translator', 'llm'],
  llmLocation: ['local', 'cloud'],
  localLlmModel: ['llama3.1', 'qwen2.5', 'gemma2']
}

function clampNumber(value, fallback, range) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return fallback
  }

  const [min, max] = range
  const clamped = Math.min(max, Math.max(min, number))

  return Math.round(clamped * 10) / 10
}

function normalizeChoice(value, fallback, options) {
  return options.includes(value) ? value : fallback
}

function readLegacyCaptureInterval(settings) {
  if (settings.captureIntervalSeconds != null) {
    return settings.captureIntervalSeconds
  }

  if (settings.captureIntervalMs != null) {
    return Number(settings.captureIntervalMs) / 1000
  }

  return defaults.captureIntervalSeconds
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

export { defaults as defaultSettings, ranges as settingRanges }
