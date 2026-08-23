import { describe, expect, it } from 'vitest'
import { parseRichText } from '../rich-text'

describe('parseRichText', () => {
  it('returns empty array for empty string', () => {
    expect(parseRichText('')).toEqual([])
  })

  it('returns a single text token for plain text', () => {
    expect(parseRichText('plain text')).toEqual([{ kind: 'text', value: 'plain text' }])
  })

  describe('bold', () => {
    it('tokenizes **bold**', () => {
      expect(parseRichText('**triangle rectangle**')).toEqual([
        { kind: 'bold', value: 'triangle rectangle' },
      ])
    })

    it('emits ** literally when unclosed', () => {
      expect(parseRichText('**unclosed')).toEqual([{ kind: 'text', value: '**unclosed' }])
    })

    it('tokenizes bold surrounded by text', () => {
      expect(parseRichText('un **triangle rectangle** ici')).toEqual([
        { kind: 'text', value: 'un ' },
        { kind: 'bold', value: 'triangle rectangle' },
        { kind: 'text', value: ' ici' },
      ])
    })

    it('tokenizes multiple bold spans', () => {
      expect(parseRichText('**a** et **b**')).toEqual([
        { kind: 'bold', value: 'a' },
        { kind: 'text', value: ' et ' },
        { kind: 'bold', value: 'b' },
      ])
    })
  })

  describe('italic', () => {
    it('tokenizes *italic*', () => {
      expect(parseRichText('*hypoténuse*')).toEqual([{ kind: 'italic', value: 'hypoténuse' }])
    })

    it('emits * literally when unclosed', () => {
      expect(parseRichText('*unclosed')).toEqual([{ kind: 'text', value: '*unclosed' }])
    })

    it('tokenizes italic surrounded by text', () => {
      expect(parseRichText("l'*hypoténuse* est")).toEqual([
        { kind: 'text', value: "l'" },
        { kind: 'italic', value: 'hypoténuse' },
        { kind: 'text', value: ' est' },
      ])
    })
  })

  describe('math', () => {
    it('tokenizes $...$', () => {
      expect(parseRichText('$x^2$')).toEqual([{ kind: 'math', value: 'x^2' }])
    })

    it('emits $ literally when unclosed', () => {
      expect(parseRichText('$unclosed')).toEqual([{ kind: 'text', value: '$unclosed' }])
    })

    it('does not parse * inside $...$', () => {
      expect(parseRichText('$x^2 * y$')).toEqual([{ kind: 'math', value: 'x^2 * y' }])
    })

    it('does not parse ** inside $...$', () => {
      expect(parseRichText('$a_1 ** a_2$')).toEqual([{ kind: 'math', value: 'a_1 ** a_2' }])
    })

    it('tokenizes multiple math spans', () => {
      expect(parseRichText('$a$ + $b$')).toEqual([
        { kind: 'math', value: 'a' },
        { kind: 'text', value: ' + ' },
        { kind: 'math', value: 'b' },
      ])
    })
  })

  describe('escaping', () => {
    it('\\* emits a literal asterisk', () => {
      expect(parseRichText('\\*')).toEqual([{ kind: 'text', value: '*' }])
    })

    it('\\* prevents opening an italic span', () => {
      expect(parseRichText('\\*mot\\*')).toEqual([{ kind: 'text', value: '*mot*' }])
    })

    it('\\$ emits a literal dollar sign', () => {
      expect(parseRichText('\\$5')).toEqual([{ kind: 'text', value: '$5' }])
    })

    it('\\$ prevents opening a math span', () => {
      expect(parseRichText('\\$a + b\\$')).toEqual([{ kind: 'text', value: '$a + b$' }])
    })
  })

  describe('mixed tokens', () => {
    it('handles bold + italic in the same string', () => {
      expect(parseRichText('**bold** and *italic*')).toEqual([
        { kind: 'bold', value: 'bold' },
        { kind: 'text', value: ' and ' },
        { kind: 'italic', value: 'italic' },
      ])
    })

    it('handles math after text', () => {
      expect(parseRichText('la formule $a^2 + b^2 = c^2$ est connue')).toEqual([
        { kind: 'text', value: 'la formule ' },
        { kind: 'math', value: 'a^2 + b^2 = c^2' },
        { kind: 'text', value: ' est connue' },
      ])
    })

    it('math is extracted before emphasis — * inside $...$ is safe', () => {
      expect(parseRichText('voir $a * b$ et **gras**')).toEqual([
        { kind: 'text', value: 'voir ' },
        { kind: 'math', value: 'a * b' },
        { kind: 'text', value: ' et ' },
        { kind: 'bold', value: 'gras' },
      ])
    })

    it('adjacent text across segment boundaries is merged', () => {
      expect(parseRichText('a $x$ b')).toEqual([
        { kind: 'text', value: 'a ' },
        { kind: 'math', value: 'x' },
        { kind: 'text', value: ' b' },
      ])
    })

    it('Pythagore prose — bold', () => {
      const input =
        "Le théorème de Pythagore relie les longueurs des trois côtés d'un **triangle rectangle**."
      expect(parseRichText(input)).toEqual([
        {
          kind: 'text',
          value: "Le théorème de Pythagore relie les longueurs des trois côtés d'un ",
        },
        { kind: 'bold', value: 'triangle rectangle' },
        { kind: 'text', value: '.' },
      ])
    })

    it('Pythagore callout — italic', () => {
      const input = "Dans un triangle rectangle, l'*hypoténuse* est le côté opposé à l'angle droit."
      expect(parseRichText(input)).toEqual([
        { kind: 'text', value: "Dans un triangle rectangle, l'" },
        { kind: 'italic', value: 'hypoténuse' },
        { kind: 'text', value: " est le côté opposé à l'angle droit." },
      ])
    })
  })
})
