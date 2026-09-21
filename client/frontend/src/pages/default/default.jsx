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
  const words = data.phrase.translation.split(" ")

  return (
    <div className="pages">
      <div className='main-elements'>
        <div className="ocr-text">
          <div className='default-text'>
            {words.map((word, i) => (
              <span key={i} className="word" onClick={() => console.log(word)}>
                {word + " "}
              </span>
            ))}
          </div>
        </div>

        {/* <button className="btn-get-frame">Получить кадр</button> */}

        <div className='explanations'>
          {data.phrase.sentences.map(sentence => (
            <SentenceBlock key={sentence.id} sentence={sentence} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Default