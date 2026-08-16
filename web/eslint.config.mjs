import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import prettier from 'eslint-config-prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  // Must be last: disables all ESLint formatting rules that conflict with Prettier.
  // Prettier runs via the PostToolUse hook — do NOT add eslint-plugin-prettier.
  prettier,
]
