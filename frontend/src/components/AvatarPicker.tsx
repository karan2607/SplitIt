import { useEffect, useState } from 'react'

interface Character {
  id: number
  name: string
  image: string
}

const QUERY = `
  query {
    Page(page: 1, perPage: 24) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full }
        image { large }
      }
    }
  }
`

async function fetchTopCharacters(): Promise<Character[]> {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY }),
  })
  const json = await res.json()
  return json.data.Page.characters.map((c: { id: number; name: { full: string }; image: { large: string } }) => ({
    id: c.id,
    name: c.name.full,
    image: c.image.large,
  }))
}

interface Props {
  selected: string | null
  onSelect: (url: string) => void
}

export default function AvatarPicker({ selected, onSelect }: Props) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchTopCharacters()
      .then(setCharacters)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-red-500">Could not load avatars. Check your connection.</p>
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">Pick a character from popular anime</p>
      <div className="grid grid-cols-6 gap-2">
        {characters.map((char) => {
          const isSelected = selected === char.image
          return (
            <button
              key={char.id}
              type="button"
              onClick={() => onSelect(char.image)}
              title={char.name}
              className={`relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none ${
                isSelected
                  ? 'border-violet-500 shadow-md shadow-violet-200 scale-105'
                  : 'border-transparent hover:border-violet-300'
              }`}
            >
              <img
                src={char.image}
                alt={char.name}
                className="w-full aspect-square object-cover bg-gray-100"
                loading="lazy"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                  <span className="text-white text-lg font-bold drop-shadow">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400">Top 24 characters by AniList favorites</p>
        {selected && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="text-xs text-gray-400 hover:text-rose-500 transition-colors"
          >
            Remove avatar
          </button>
        )}
      </div>
    </div>
  )
}
