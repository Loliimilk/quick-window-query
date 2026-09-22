import { useTranslation } from "react-i18next"

function Settings() {
  const { t, i18n } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="pages">
      <div>
        <h1>{t('pages.settings.title')}</h1>
            <div>
                <button
                    type="button"
                    onClick={() => i18n.changeLanguage('ru')}
                    disabled={currentLanguage === 'ru'}
                >   
                    {t('pages.settings.russian')}
                </button>
                <button
                    type="button"
                    onClick={() => i18n.changeLanguage('en')}
                    disabled={currentLanguage === 'en'}
                >   
                    {t('pages.settings.english')}
                </button>
            </div>
            <p>
                {t('pages.settings.currentLanguage')}: {currentLanguage?.toUpperCase()}
            </p>
      </div>
    </div>
  )
}

export default Settings