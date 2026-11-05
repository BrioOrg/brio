package fr.brio.identite.api;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Published query port for students' out-of-class identity (ADR 0035 §8). */
public interface ProfilsElevesQuery {

    /**
     * The profile of each given student account, keyed by account ID. Any ID that is not a student
     * is simply absent. One lookup for the whole set. Never {@code null}.
     */
    Map<UUID, ProfilEleve> profils(Set<UUID> compteIds);
}
