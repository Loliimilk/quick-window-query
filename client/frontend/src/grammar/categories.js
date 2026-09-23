export const grammarCategories = {
  tense: { color: '#B3A5DE', label: 'grammarCategories.tense' },
  structure: { color: '#96C0D6', label: 'grammarCategories.structure' },
  idiom: { color: '#E7AC7E', label: 'grammarCategories.idiom' },
  word_order: { color: '#ACCE9C', label: 'grammarCategories.word_order' },
  false_friend: { color: '#E29A96', label: 'grammarCategories.false_friend' },
  articles: { color: '#D9BE7E', label: 'grammarCategories.articles' },
  prepositions: { color: '#8FCFC5', label: 'grammarCategories.prepositions' },
  modality: { color: '#D79FC4', label: 'grammarCategories.modality' }
}

export function getGrammarCategory(category) {
  return grammarCategories[category] ?? { color: '#999', label: category }
}
