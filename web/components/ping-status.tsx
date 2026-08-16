import type { components } from '@brio/api-client'
import { clsx } from 'clsx'

type PingResponse = components['schemas']['PingResponse']

type Props =
  | { result: { status: 'success'; data: PingResponse } }
  | { result: { status: 'error' } }

export function PingStatus({ result }: Props) {
  if (result.status === 'error') {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
      >
        <p className="font-semibold">Serveur inaccessible</p>
        <p className="mt-1 text-sm">
          Impossible de joindre le backend. Vérifiez qu&apos;il est démarré sur{' '}
          <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">
            {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'}
          </code>
          .
        </p>
      </div>
    )
  }

  const { data } = result
  const isOk = data.status === 'ok'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={clsx('h-3 w-3 rounded-full', isOk ? 'bg-green-500' : 'bg-yellow-500')}
        />
        <span className={clsx('font-semibold', isOk ? 'text-green-700' : 'text-yellow-700')}>
          {data.status}
        </span>
      </div>
      <dl className="text-sm text-gray-600 space-y-1">
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">Version</dt>
          <dd className="font-mono">{data.version}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-gray-900">Horodatage</dt>
          <dd className="font-mono">{data.timestamp}</dd>
        </div>
      </dl>
    </div>
  )
}
