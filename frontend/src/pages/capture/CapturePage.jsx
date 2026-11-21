import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './CapturePage.css'
import data from './phrase.json'
import noteIcon from '../../assets/note.svg'
import captureIcon from '../../assets/capture.svg'
import { getGrammarCategory } from '../../grammar/categories.js'

function Highlight({ text, color, category, isHovered, onEnter, onLeave }) {
  return (
    <span
      className={`colored ${isHovered ? 'hovered' : ''}`}
      data-category={category}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ '--accent-color': color }}
    >
      {text}
    </span>
  )
}

function SentenceBlock({ sentence, onAddPhraseToNotes }) {
  const { t } = useTranslation()
  const [hoveredId, setHoveredId] = useState(null)

  const partData = {}

  for (const construction of sentence.constructions) {
    const meta = getGrammarCategory(construction.category)

    for (const ref of construction.refs) {
      if (!partData[ref]) {
        partData[ref] = {
          id: construction.id,
          color: meta.color,
          category: construction.category
        }
      }
    }
  }

  return (
    <div className="explanation">
      <div className="sentences">
        <p className="sentence">
          {sentence.parts.map((part, i) => {
            const highlight = partData[i]

            if (!highlight) {
              return <span key={i}>{part.text}</span>
            }

            return (
              <Highlight
                key={i}
                text={part.text}
                color={highlight.color}
                category={highlight.category}
                isHovered={hoveredId === highlight.id}
                onEnter={() => setHoveredId(highlight.id)}
                onLeave={() => setHoveredId(null)}
              />
            )
          })}
        </p>

        <p className="sentence-translation">{sentence.translation}</p>

        <button
          type="button"
          className="add-dictionary"
          onClick={() => onAddPhraseToNotes?.(sentence)}
          aria-label={t('pages.home.addNote')}
          title={t('pages.home.addNote')}
        >
          <img src={noteIcon} alt={t('common.note')} className="img-button-add" />
        </button>
      </div>

      <div className="grammars">
        {sentence.constructions.map(construction => {
          const meta = getGrammarCategory(construction.category)
          const isHovered = hoveredId === construction.id

          return (
            <div
              key={construction.id}
              className={`grammar-item ${isHovered ? 'active' : ''}`}
              onMouseEnter={() => setHoveredId(construction.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ '--accent-color': meta.color }}
            >
              <p className="category-title">{t(meta.label)}</p>
              <p className="grammar-desc">{construction.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CapturePage({ onAddPhraseToNotes }) {
  const { t } = useTranslation()
  const [isOn, setIsOn] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [ocrResult, setOcrResult] = useState(null)
  const [serviceError, setServiceError] = useState('')
  const [hasBounds, setHasBounds] = useState(false)
  const captureControlTouched = useRef(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/capture')
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(state => {
        if (!cancelled && !captureControlTouched.current) {
          setIsCapturing(Boolean(state.active))
          setIsProcessing(Boolean(state.processing))
          setHasBounds(Boolean(state.bounds_ready))
          if (state.last_error) {
            setServiceError(`${t('pages.home.ocrError')}: ${state.last_error}`)
          }
        }
      })
      .catch(() => {})
    fetch('/api/ocr-result', { cache: 'no-store' })
      .then(response => {
        if (response.status === 204) return null
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(result => {
        if (!cancelled && !captureControlTouched.current && result) {
          setOcrResult(result)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    if (!isCapturing && !isProcessing) return undefined

    let cancelled = false
    let timer
    const pollResult = async () => {
      try {
        const [resultResponse, stateResponse] = await Promise.all([
          fetch('/api/ocr-result', { cache: 'no-store' }),
          fetch('/api/capture', { cache: 'no-store' })
        ])
        if (stateResponse.status !== 200) {
          throw new Error(`Capture API returned HTTP ${stateResponse.status}`)
        }
        const state = await stateResponse.json()
        let finalResultResponse = resultResponse
        if (!state.active && !state.processing && resultResponse.status === 204) {
          finalResultResponse = await fetch('/api/ocr-result', { cache: 'no-store' })
        }
        if (finalResultResponse.status === 200) {
          const result = await finalResultResponse.json()
          if (!cancelled) setOcrResult(result)
        } else if (finalResultResponse.status !== 204) {
          throw new Error(`OCR API returned HTTP ${finalResultResponse.status}`)
        }
        if (!cancelled) {
          if (Boolean(state.active) !== isCapturing) {
            setIsCapturing(Boolean(state.active))
          }
          setIsProcessing(Boolean(state.processing))
          setHasBounds(Boolean(state.bounds_ready))
          if (state.last_error) {
            setServiceError(`${t('pages.home.ocrError')}: ${state.last_error}`)
          } else {
            setServiceError('')
          }
        }
      } catch {
        if (!cancelled) setServiceError(t('pages.home.backendError'))
      } finally {
        if (!cancelled) timer = window.setTimeout(pollResult, 750)
      }
    }

    void pollResult()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isCapturing, isProcessing, t])

  const toggleCapture = async () => {
    captureControlTouched.current = true
    const active = !isCapturing
    setIsBusy(true)
    setServiceError('')
    try {
      const response = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      })
      if (response.status === 409) {
        throw new Error(t('pages.home.captureBusy'))
      }
      if (!response.ok) throw new Error(t('pages.home.backendError'))
      const state = await response.json()
      if (!active) {
        const resultResponse = await fetch('/api/ocr-result', { cache: 'no-store' })
        if (resultResponse.status === 200) {
          setOcrResult(await resultResponse.json())
        } else if (resultResponse.status !== 204) {
          throw new Error(`OCR API returned HTTP ${resultResponse.status}`)
        }
      }
      setIsCapturing(Boolean(state.active))
      setIsProcessing(Boolean(state.processing))
      setHasBounds(Boolean(state.bounds_ready))
      setServiceError(
        state.last_error
          ? `${t('pages.home.ocrError')}: ${state.last_error}`
          : ''
      )
      if (state.active) {
        setOcrResult(null)
        setIsOn(false)
      }
    } catch (error) {
      setServiceError(error instanceof Error ? error.message : t('pages.home.backendError'))
    } finally {
      setIsBusy(false)
    }
  }

  const showSample = !isCapturing && !isProcessing && !ocrResult
  const recognizedText = ocrResult
    ? (ocrResult.lines?.length ? ocrResult.lines.join('\n') : ocrResult.text || '')
    : ''
  const visibleWords = (isOn ? data.phrase.translation : data.phrase.original).split(' ')
  const captureLabel = isCapturing
    ? t('pages.home.captureButton.active')
    : t('pages.home.captureButton.idle')

  return (
    <div className="pages">
      <div className="main-elements">
        {serviceError && <p className="capture-error" role="alert">{serviceError}</p>}

        <div className="ocr-text">
          <div className="ocr-toolbar">
            {showSample && (
              <label className="language-switch">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => setIsOn(value => !value)}
                  aria-label={t('languageSwitch.aria', {
                    source: t('languages.english'),
                    target: t('languages.russian')
                  })}
                />

                <span className="language-slider">
                  <span className="language-option language-left">EN</span>
                  <span className="language-option language-right">RU</span>
                </span>
              </label>
            )}

            <button
              type="button"
              className={`capture-button ${isCapturing ? 'is-capturing' : ''}`}
              onClick={toggleCapture}
              disabled={isBusy || (!isCapturing && isProcessing)}
              aria-label={captureLabel}
              aria-pressed={isCapturing}
            >
              <img src={captureIcon} alt="" aria-hidden="true" className="capture-icon" />
              <span className="capture-label">{captureLabel}</span>
            </button>
          </div>

          <div className="default-text">
            {(isCapturing || isProcessing) && !ocrResult && (
              <p className="text-inner">
                {hasBounds
                  ? t('pages.home.waitingForOCR')
                  : t('pages.home.waitingForBounds')}
              </p>
            )}
            {ocrResult && (
              <p className="text-inner ocr-result">
                {recognizedText || t('pages.home.noTextFound')}
              </p>
            )}
            {showSample && (
              <div key={isOn ? 'translated' : 'original'} className="text-inner">
                {visibleWords.map((word, i) => (
                  <span key={i} className="word" onClick={() => console.log(word)}>
                    {word}{' '}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {showSample && (
          <div className="explanations">
            {data.phrase.sentences.map(sentence => (
              <SentenceBlock
                key={sentence.id}
                sentence={sentence}
                onAddPhraseToNotes={onAddPhraseToNotes}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CapturePage
