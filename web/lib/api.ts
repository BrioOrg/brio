import { createApiClient } from '@brio/api-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const client = createApiClient(API_URL)

export async function getPingStatus() {
  const { data, error } = await client.GET('/api/ping')
  if (error) throw new Error('Ping failed')
  return data
}
