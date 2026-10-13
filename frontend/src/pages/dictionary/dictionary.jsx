import { useTranslation } from 'react-i18next'

function Dictionary() {
    const { t } = useTranslation()

    return (
        <div className="pages">
            <h1>{t('pages.dictionary.title')}</h1>
        </div>
    )
}

export default Dictionary
