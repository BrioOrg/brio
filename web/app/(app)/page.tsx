import { redirect } from 'next/navigation'

// Until the Accueil page exists (#324), the home of the app is Explorer.
export default function HomePage() {
  redirect('/explorer')
}
