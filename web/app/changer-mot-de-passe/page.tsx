import type { Metadata } from 'next'
import { ChangerMotDePasseForm } from '@/components/changer-mot-de-passe-form'

export const metadata: Metadata = {
  title: 'Choisir mon mot de passe — brio',
}

// After a teacher-led reset (ADR 0036): the student has logged in with the provisional password
// and must choose their own before anything else. Outside the app shell, like /connexion: the
// backend refuses every other call until the change is made, and the middleware sends every
// other page here. Not a public route — it only makes sense with the session just opened.
export default function ChangerMotDePassePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-display text-2xl font-black tracking-tight text-ink">
            br<span className="text-accent">io</span>
          </span>
        </div>

        <div className="rounded-lg border border-line bg-surface-panel p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black leading-tight tracking-tight text-ink">
            Choisis ton <span className="text-accent">mot de passe</span>
          </h1>
          <p className="mt-2 mb-6 font-prose text-sm text-ink-muted">
            Le mot de passe provisoire de ton prof ne marche qu’une fois. Choisis maintenant le tien
            : c’est lui que tu taperas les prochaines fois. Ne le donne à personne.
          </p>

          <ChangerMotDePasseForm />
        </div>
      </div>
    </main>
  )
}
