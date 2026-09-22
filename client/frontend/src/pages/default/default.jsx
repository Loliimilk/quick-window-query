import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './default.css'
import data from './phrase.json'
import noteIcon from '../../assets/note.svg'
import captureIcon from '../../assets/capture.svg'

const categories = {
  tense: { color: '#B3A5DE', label: 'grammarCategories.tense' },
  structure: { color: '#96C0D6', label: 'grammarCategories.structure' },
  idiom: { color: '#E7AC7E', label: 'grammarCategories.idiom' },
  word_order: { color: '#ACCE9C', label: 'grammarCategories.word_order' },
  false_friend: { color: '#E29A96', label: 'grammarCategories.false_friend' },
  articles: { color: '#D9BE7E', label: 'grammarCategories.articles' },
  prepositions: { color: '#8FCFC5', label: 'grammarCategories.prepositions' },
  modality: { color: '#D79FC4', label: 'grammarCategories.modality' }
}

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

function SentenceBlock({ sentence }) {
  const { t } = useTranslation()
  const [hoveredId, setHoveredId] = useState(null)

  const getCategory = category => categories[category] ?? { color: '#999', label: category }
  const partData = {}

  for (const construction of sentence.constructions) {
    const meta = getCategory(construction.category)

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

        <button className="add-dictionary">
          <img src={noteIcon} alt="note" className="img-button-add" />
        </button>
      </div>

      <div className="grammars">
        {sentence.constructions.map(construction => {
          const meta = getCategory(construction.category)
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

function Default() {
  const { t } = useTranslation()
  const [isOn, setIsOn] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)

  const visibleWords = (isOn ? data.phrase.translation : data.phrase.original).split(' ')
  const captureLabel = isCapturing
    ? t('pages.home.captureButton.active')
    : t('pages.home.captureButton.idle')

  return (
    <div className="pages">
      <div className="main-elements">
        <button
          type="button"
          className={`capture-button ${isCapturing ? 'is-capturing' : ''}`}
          onClick={() => setIsCapturing(value => !value)}
          aria-label={captureLabel}
          aria-pressed={isCapturing}
        >
          <img src={captureIcon} alt="" aria-hidden="true" className="capture-icon" />
          <span className="capture-label">{captureLabel}</span>
        </button>

        <div className="ocr-text">
          <label className="language-switch">
            <input
              type="checkbox"
              checked={isOn}
              onChange={() => setIsOn(value => !value)}
              aria-label="Switch between English and Russian"
            />

            <span className="language-slider">
              <span className="language-option language-left">EN</span>
              <span className="language-option language-right">RU</span>
            </span>
          </label>

          <div className="default-text">
            <div key={isOn ? 'translated' : 'original'} className="text-inner">
              {visibleWords.map((word, i) => (
                <span key={i} className="word" onClick={() => console.log(word)}>
                  {word}{' '}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="explanations">
          {data.phrase.sentences.map(sentence => (
            <SentenceBlock key={sentence.id} sentence={sentence} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Default
