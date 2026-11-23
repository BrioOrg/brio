package fr.brio.contenu.api;

import java.util.List;
import java.util.UUID;

/**
 * Structural fact about the currently published version of a teacher course (ADR 0050 §1),
 * published by contenu when a version is published and re-announced for every published course
 * at startup, so progression can keep a projection without reaching into contenu.
 *
 * <p>This is <b>not</b> a per-student event and carries no title, status or class. Elements are
 * keyed by the editor's stable ids — section ids and exercise block ids, which survive a
 * republication — never by the exercise UUIDs that each version mints afresh. {@code exerciceCles}
 * only lists gradable exercises: a {@code paper} exercise has no evaluator and could never be
 * solved, so counting it would make the course impossible to finish.
 */
public record CoursPublie(UUID coursId, int version, List<String> sectionIds, List<String> exerciceCles) {

    public CoursPublie {
        sectionIds = List.copyOf(sectionIds);
        exerciceCles = List.copyOf(exerciceCles);
    }
}
