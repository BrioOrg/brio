package fr.brio.contenu.api;

import java.util.Set;

/**
 * The exercise types exercices can grade (its evaluators). Only these count toward a teacher
 * course's completion: {@code paper}, and any type with no evaluator ({@code free-text},
 * {@code ordering}, an unknown type), could never be solved and would block the course (ADR 0050
 * §5). contenu cannot ask exercices (module cycle), so {@code TypesCorrigeablesTest} keeps this
 * list equal to exercices' evaluators.
 */
public final class TypesCorrigeables {

    public static final Set<String> TYPES = Set.of("multiple-choice", "short-answer", "numeric", "fill-blank");

    private TypesCorrigeables() {}
}
