# Content authoring conventions (`content/`)

Course and exercise content is French prose read by secondary-school students.
Correctness and legibility come first — this is read by minors (see CLAUDE.md).

## Numbers and punctuation

- **A decimal number is never glued to sentence punctuation.** In French the
  decimal separator is a comma (`8,053`), so a decimal immediately followed by a
  clause comma reads as one blurred token — `8,053,` looks like a longer number
  and is ugly. Reformulate so the number is not touched by a comma:
  - move the number to the end of the clause —
    `Dans le nombre 8,053, quel chiffre…` → `Quel chiffre… dans le nombre 8,053 ?`
  - replace `X, c'est Y` with `X revient à Y` —
    `diviser par 0,5, c'est multiplier par 2` → `diviser par 0,5 revient à multiplier par 2`
  - set an aside in parentheses —
    `une valeur approchée, 3,14, et le résultat` → `une valeur approchée (3,14) et le résultat`
  - separate a list of decimals with semicolons, not commas —
    `0,5, 0,75 et 0,4` → `0,5 ; 0,75 et 0,4`
  - or simply drop a clause comma when the sentence stays clear —
    `= 1,5, et 1,5 < 5` → `= 1,5 et 1,5 < 5`
- A decimal before a full stop, colon, or closing parenthesis is fine
  (`… = 0,5.`): only the comma is ambiguous.
- Group the digits of large integers with a thin space, never a comma
  (`4 725 039`, not `4,725,039`).
