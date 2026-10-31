import { redirect } from 'next/navigation'

// Homework now lives in the class space (#322); the old URL stays valid for existing links.
export default function DevoirsPage() {
  redirect('/ma-classe')
}
