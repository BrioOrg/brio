'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { mesClasses, type MaClasse } from '@brio/api-client'

import { messageErreur } from '@/components/messagerie/messagerie-format'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SelectInput } from '@/components/ui/select-input'
import { Skeleton } from '@/components/ui/skeleton'
import { apiBaseUrl } from '@/lib/api-base-url'

const ONGLETS = [
  { href: '/ma-classe', label: 'À faire' },
  { href: '/ma-classe/cours', label: 'Cours du prof' },
  { href: '/ma-classe/salon', label: 'Salon' },
]

const ClasseChoisie = createContext<MaClasse | null>(null)

/** The class picked in the Ma classe header; only usable inside EspaceClasse. */
export function useClasseChoisie(): MaClasse {
  const classe = useContext(ClasseChoisie)
  if (!classe) throw new Error('useClasseChoisie must be used inside EspaceClasse')
  return classe
}

/**
 * The class space's frame, kept across its tabs: the header, the class picker and the
 * sub-navigation. The picked class lives here, so switching tabs keeps it and changing it updates
 * the open tab. A student in no class gets the way to join one instead of the tabs.
 */
export function EspaceClasse({ children }: { children: React.ReactNode }) {
  const [classes, setClasses] = useState<MaClasse[] | null>(null)
  const [classeId, setClasseId] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    mesClasses(apiBaseUrl())
      .then((cs) => {
        if (!vivant) return
        setClasses(cs)
        setClasseId(cs[0]?.id ?? null)
      })
      .catch((e) => {
        if (vivant) setErreur(messageErreur(e, 'Impossible de charger ta classe.'))
      })
    return () => {
      vivant = false
    }
  }, [])

  const classe = classes?.find((c) => c.id === classeId) ?? null

  return (
    <main className="px-4 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {erreur && (
          <p role="alert" className="font-prose text-sm text-danger">
            {erreur}
          </p>
        )}

        {classes === null && !erreur && <Skeleton className="h-32 w-full" />}

        {classes !== null && classes.length === 0 && (
          <EmptyState
            icon="chalkboard"
            title="Rejoins ta classe avec un code"
            description="Ton prof te donne le code. Tu retrouveras ici tes devoirs, ses cours et le salon de la classe."
            action={
              <Link href="/rejoindre">
                <Button tabIndex={-1}>Rejoindre ma classe</Button>
              </Link>
            }
          />
        )}

        {classes !== null && classe && (
          <>
            <header className="flex flex-col gap-2">
              <h1 className="font-display text-2xl font-extrabold text-ink">
                {[classe.libelle, classe.etablissementNom, classe.anneeScolaire]
                  .filter(Boolean)
                  .join(' · ')}
              </h1>
              {classe.nomAffiche && (
                <p className="font-prose text-sm text-ink-muted">
                  Dans cette classe tu es{' '}
                  <strong className="font-semibold text-ink">{classe.nomAffiche}</strong>
                </p>
              )}
            </header>

            {classes.length > 1 && (
              <SelectInput
                label="Classe"
                value={classe.id}
                onChange={(e) => setClasseId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.libelle}
                  </option>
                ))}
              </SelectInput>
            )}

            <OngletsClasse />

            <ClasseChoisie.Provider value={classe}>{children}</ClasseChoisie.Provider>
          </>
        )}
      </div>
    </main>
  )
}

function OngletsClasse() {
  const pathname = usePathname()
  return (
    <nav aria-label="Espace de la classe" className="flex gap-1 border-b border-line">
      {ONGLETS.map(({ href, label }) => {
        const actif = pathname === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={actif ? 'page' : undefined}
            className={[
              '-mb-px border-b-2 px-3 py-2 font-display text-sm font-extrabold transition-colors duration-[var(--duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              actif ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
