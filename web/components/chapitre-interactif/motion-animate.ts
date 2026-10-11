// Only what the slide transitions use: a dynamic `import('motion')` would bundle the whole
// namespace (48 kB gzip instead of about 20 kB), since a namespace import cannot be tree-shaken.
export { animate } from 'motion'
