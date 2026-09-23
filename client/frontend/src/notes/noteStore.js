const STORAGE_KEY = 'qwq.notes.v1'

function getNow() {
  return new Date().toISOString()
}

function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getSentenceText(sentence) {
  return sentence.parts
    .map(part => part.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeExplanation(explanation) {
  if (!explanation || typeof explanation !== 'object') {
    return null
  }

  return {
    id: explanation.id == null ? createId('explanation') : String(explanation.id),
    category: typeof explanation.category === 'string' ? explanation.category : '',
    description: typeof explanation.description === 'string' ? explanation.description : '',
    refs: Array.isArray(explanation.refs) ? explanation.refs : []
  }
}

function normalizePart(part) {
  if (!part || typeof part !== 'object') {
    return null
  }

  return {
    text: typeof part.text === 'string' ? part.text : ''
  }
}

function normalizeNote(note) {
  if (!note || typeof note !== 'object' || !note.id) {
    return null
  }

  const createdAt = typeof note.createdAt === 'string' ? note.createdAt : getNow()
  const updatedAt = typeof note.updatedAt === 'string' ? note.updatedAt : createdAt

  return {
    id: String(note.id),
    source: typeof note.source === 'string' ? note.source : 'manual',
    sourceId: note.sourceId == null ? null : String(note.sourceId),
    phrase: typeof note.phrase === 'string' ? note.phrase : '',
    parts: Array.isArray(note.parts)
      ? note.parts.map(normalizePart).filter(Boolean)
      : [],
    translation: typeof note.translation === 'string' ? note.translation : '',
    explanations: Array.isArray(note.explanations)
      ? note.explanations.map(normalizeExplanation).filter(Boolean)
      : [],
    text: typeof note.text === 'string' ? note.text : '',
    createdAt,
    updatedAt
  }
}

export function readNotes() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const rawNotes = window.localStorage.getItem(STORAGE_KEY)
    const parsedNotes = rawNotes ? JSON.parse(rawNotes) : []

    return Array.isArray(parsedNotes)
      ? parsedNotes.map(normalizeNote).filter(Boolean)
      : []
  } catch {
    return []
  }
}

export function writeNotes(notes) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  } catch {
    return
  }
}

export function createPhraseNote(sentence) {
  const now = getNow()

  return {
    id: `note-default-${sentence.id}`,
    source: 'default',
    sourceId: String(sentence.id),
    phrase: getSentenceText(sentence),
    parts: sentence.parts.map(part => ({ text: part.text })),
    translation: sentence.translation,
    explanations: sentence.constructions.map(construction => ({
      id: String(construction.id),
      category: construction.category,
      description: construction.description,
      refs: construction.refs
    })),
    text: '',
    createdAt: now,
    updatedAt: now
  }
}

export function createManualNote(text) {
  const now = getNow()

  return {
    id: createId('note'),
    source: 'manual',
    sourceId: null,
    phrase: '',
    parts: [],
    translation: '',
    explanations: [],
    text,
    createdAt: now,
    updatedAt: now
  }
}
