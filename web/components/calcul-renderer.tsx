import { buildCalculModel, type CalculSpec } from '@brio/content'

import { RichTextRenderer } from '@/components/blocs/rich-text'
import { CalculLignes, type LigneCalcul } from '@/components/chapitre-interactif/calcul-lignes'
import { renderCalculKatex } from '@/lib/katex'

type Props = {
  id: string
  spec: CalculSpec
  /** Lines shown, for the /design demo; elsewhere the interactive mode decides. */
  visibles?: number
}

/**
 * A worked calculation (ADR 0042). The model (`@brio/content`) splits each line on its relation;
 * here each part becomes KaTeX, and `CalculLignes` lays the parts out in aligned columns and
 * reveals them one at a time in the interactive mode.
 */
export function CalculRenderer({ id, spec, visibles }: Props) {
  const model = buildCalculModel(spec)
  const lignes: LigneCalcul[] = model.rows.map((row) => {
    return {
      lhs: renderCalculKatex(row.lhs, 'html'),
      rel: row.rel ? renderCalculKatex(`{}${row.rel}{}`, 'html') : '',
      rhs: renderCalculKatex(row.rhs, 'html'),
      lu: renderCalculKatex(row.spoken, 'mathml'),
      ...(row.op
        ? {
            op: {
              html: renderCalculKatex(row.op.latex, 'html'),
              lu: renderCalculKatex(row.op.latex, 'mathml'),
              rhsAvant: renderCalculKatex(row.op.rhsBefore, 'html'),
            },
          }
        : {}),
      ...(row.note ? { note: <RichTextRenderer text={row.note} /> } : {}),
    }
  })
  const title = typeof spec.title === 'string' && spec.title.trim() ? spec.title : undefined

  return (
    <div id={id}>
      {title && (
        <p className="mb-2 font-display text-base font-bold text-ink">
          <RichTextRenderer text={title} />
        </p>
      )}
      <CalculLignes
        blockId={id}
        lignes={lignes}
        conclusion={model.conclusion ? <RichTextRenderer text={model.conclusion} /> : undefined}
        visibles={visibles}
      />
    </div>
  )
}
