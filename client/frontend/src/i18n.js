import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import ru from './locales/ru.json'

const supportedLanguages = ['en', 'ru']

function readSavedLanguage() {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem('appLanguage')
  } catch {
    return null
  }
}

function saveLanguage(language) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem('appLanguage', language)
  } catch {
    return
  }
}

const savedLanguage = readSavedLanguage()
const initialLanguage = supportedLanguages.includes(savedLanguage)
  ? savedLanguage
  : 'ru'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru }
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false
    }
  })

function applyLanguage(language) {
  document.documentElement.lang = language
  saveLanguage(language)
}

applyLanguage(i18n.language)

i18n.on('languageChanged', (language) => {
  applyLanguage(language)
})

if (typeof window !== 'undefined') {
  window.setAppLanguage = (language) => {
    if (!supportedLanguages.includes(language)) {
      return Promise.reject(new Error(`Unsupported language: ${language}`))
    }

    return i18n.changeLanguage(language)
  }

  window.getAppLanguage = () => i18n.language
}

export default i18n
