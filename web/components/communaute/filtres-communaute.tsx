'use client'

import { useRouter } from 'next/navigation'

import { SelectInput } from '@/components/ui/select-input'
import { TOUS_LES_NIVEAUX, urlCommunaute } from '@/lib/communaute'

type Option = { code: string; libelle: string }

type Props = {
  niveau: string
  /** Empty: every subject. */
  matiere: string
  niveaux: Option[]
  matieres: Option[]
}

/** Changing a filter changes the URL, and the server renders the list again from the first page. */
export function FiltresCommunaute({ niveau, matiere, niveaux, matieres }: Props) {
  const router = useRouter()

  return (
    <form
      aria-label="Filtrer les questions"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <SelectInput
        label="Niveau"
        value={niveau}
        onChange={(e) => router.push(urlCommunaute({ niveau: e.target.value, matiere }))}
      >
        <option value={TOUS_LES_NIVEAUX}>Tous les niveaux</option>
        {niveaux.map((n) => (
          <option key={n.code} value={n.code}>
            {n.libelle}
          </option>
        ))}
      </SelectInput>
      <SelectInput
        label="Matière"
        value={matiere}
        onChange={(e) => router.push(urlCommunaute({ niveau, matiere: e.target.value }))}
      >
        <option value="">Toutes les matières</option>
        {matieres.map((m) => (
          <option key={m.code} value={m.code}>
            {m.libelle}
          </option>
        ))}
      </SelectInput>
    </form>
  )
}
