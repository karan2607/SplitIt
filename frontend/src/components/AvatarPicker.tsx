// Anime/show-inspired avatars using DiceBear's adventurer style.
// Each seed produces a unique anime-style character illustration.
const AVATARS: { seed: string; label: string; show: string }[] = [
  // Naruto
  { seed: 'Naruto-Uzumaki', label: 'Naruto', show: 'Naruto' },
  { seed: 'Sasuke-Uchiha', label: 'Sasuke', show: 'Naruto' },
  { seed: 'Kakashi-Hatake', label: 'Kakashi', show: 'Naruto' },
  { seed: 'Itachi-Uchiha', label: 'Itachi', show: 'Naruto' },
  // One Piece
  { seed: 'Monkey-Luffy', label: 'Luffy', show: 'One Piece' },
  { seed: 'Roronoa-Zoro', label: 'Zoro', show: 'One Piece' },
  { seed: 'Boa-Hancock', label: 'Hancock', show: 'One Piece' },
  { seed: 'Trafalgar-Law', label: 'Law', show: 'One Piece' },
  // Attack on Titan
  { seed: 'Eren-Yeager', label: 'Eren', show: 'AoT' },
  { seed: 'Mikasa-Ackerman', label: 'Mikasa', show: 'AoT' },
  { seed: 'Levi-Ackerman', label: 'Levi', show: 'AoT' },
  { seed: 'Armin-Arlert', label: 'Armin', show: 'AoT' },
  // Demon Slayer
  { seed: 'Tanjiro-Kamado', label: 'Tanjiro', show: 'Demon Slayer' },
  { seed: 'Nezuko-Kamado', label: 'Nezuko', show: 'Demon Slayer' },
  { seed: 'Zenitsu-Agatsuma', label: 'Zenitsu', show: 'Demon Slayer' },
  { seed: 'Inosuke-Hashibira', label: 'Inosuke', show: 'Demon Slayer' },
  // Dragon Ball
  { seed: 'Goku-Saiyan', label: 'Goku', show: 'Dragon Ball' },
  { seed: 'Vegeta-Prince', label: 'Vegeta', show: 'Dragon Ball' },
  // HxH / OPM
  { seed: 'Killua-Zoldyck', label: 'Killua', show: 'HxH' },
  { seed: 'Gon-Freecss', label: 'Gon', show: 'HxH' },
  { seed: 'Saitama-Hero', label: 'Saitama', show: 'OPM' },
  // Misc
  { seed: 'Zero-Two-Darling', label: 'Zero Two', show: 'FranXX' },
  { seed: 'Rem-ReZero', label: 'Rem', show: 'Re:Zero' },
  { seed: 'Light-Yagami', label: 'Light', show: 'Death Note' },
]

function avatarUrl(seed: string) {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

export { avatarUrl, AVATARS }

interface Props {
  selected: string | null
  onSelect: (url: string) => void
}

export default function AvatarPicker({ selected, onSelect }: Props) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">Pick a character avatar</p>
      <div className="grid grid-cols-6 gap-2">
        {AVATARS.map(({ seed, label, show }) => {
          const url = avatarUrl(seed)
          const isSelected = selected === url
          return (
            <button
              key={seed}
              type="button"
              onClick={() => onSelect(url)}
              title={`${label} — ${show}`}
              className={`relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none ${
                isSelected
                  ? 'border-violet-500 shadow-md shadow-violet-200 scale-105'
                  : 'border-transparent hover:border-violet-300'
              }`}
            >
              <img
                src={url}
                alt={label}
                className="w-full aspect-square bg-violet-50"
                loading="lazy"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-violet-500/10 flex items-center justify-center">
                  <span className="text-violet-600 text-lg font-bold drop-shadow">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => onSelect('')}
          className="mt-2 text-xs text-gray-400 hover:text-rose-500 transition-colors"
        >
          Remove avatar
        </button>
      )}
    </div>
  )
}
