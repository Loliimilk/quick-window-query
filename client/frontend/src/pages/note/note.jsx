import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

function Note(){
    const {t} = useTranslation()
    return(
        <div className="pages">
            <h1>{t('pages.notes.title')}</h1>
        </div>
    )
}

export default Note