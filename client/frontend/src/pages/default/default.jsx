import React, { useState } from 'react'
import './default.css'
import data from './phrase.json'
import noteIcon from '../../assets/note.svg'

const categories = {
  tense:        { color: "#B3A5DE", label: "tense" },
  structure:    { color: "#96C0D6", label: "structure" },
  idiom:        { color: "#E7AC7E", label: "idiom" },
  word_order:   { color: "#ACCE9C", label: "word_order" },
  false_friend: { color: "#E29A96", label: "false_friend" },
  articles:     { color: "#D9BE7E", label: "articles" },
  prepositions: { color: "#8FCFC5", label: "prepositions" },
  modality:     { color: "#D79FC4", label: "modality" }
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
  const [hoveredId, setHoveredId] = useState(null)
  const metaOf = (category) => categories[category] ?? { color: '#999', label: category }

  const partData = {}
  for (const c of sentence.constructions) {
    const meta = metaOf(c.category)
    for (const ref of c.refs) {
      if (!partData[ref]) {
        partData[ref] = { id: c.id, color: meta.color, category: c.category }
      }
    }
  }

  return (
    <div className='explanation'>
      <div className='sentences'>
        <p className='sentence'>
          {sentence.parts.map((part, i) => {
            const data = partData[i]
            return data
              ? <Highlight
                  key={i}
                  text={part.text}
                  color={data.color}
                  category={data.category}
                  isHovered={hoveredId === data.id}
                  onEnter={() => setHoveredId(data.id)}
                  onLeave={() => setHoveredId(null)}
                />
              : <span key={i}>{part.text}</span>
          })}
        </p>
        <p className='sentence-translation'>{sentence.translation}</p>
        <button className='add-dictionary'>
          <img src={noteIcon} alt='note' className='img-button-add' />
        </button>
      </div>

      <div className='grammars'>
        {sentence.constructions.map(c => {
          const meta = metaOf(c.category)
          const isHovered = hoveredId === c.id
          
          return (
            <div 
              key={c.id} 
              className={`grammar-item ${isHovered ? 'active' : ''}`}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ '--accent-color': meta.color }}
            >
              <p className='category-title'>{meta.label}</p>
              <p className='grammar-desc'>{c.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Default() {
  const [isOn, setIsOn] = useState(false)

  const sourceLanguage = { code: "EN", name: "English" }
  const targetLanguage = { code: "RU", name: "Russian" }

  const originalWords = data.phrase.original.split(" ")
  const translatedWords = data.phrase.translation.split(" ")

  const handleToggle = () => setIsOn(prev => !prev)
  const visibleWords = isOn ? translatedWords : originalWords

  return (
    <div className="pages">
      <div className="main-elements">
        <div className="ocr-text">
          <label className="language-switch">
            <input
              type="checkbox"
              checked={isOn}
              onChange={handleToggle}
              aria-label={`Switch between ${sourceLanguage.name} and ${targetLanguage.name}`}
            />

            <span className="language-slider">
              <span className="language-option language-left" title={sourceLanguage.name}>
                {sourceLanguage.code}
              </span>
              <span className="language-option language-right" title={targetLanguage.name}>
                {targetLanguage.code}
              </span>
            </span>
          </label>

          <div className="default-text">
            <div key={isOn ? "translated" : "original"} className="text-inner">
              {visibleWords.map((word, i) => (
                <span key={`${word}-${i}`} className="word" onClick={() => console.log(word)}>
                  {word}{" "}
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