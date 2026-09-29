package fr.brio.devoirs.infrastructure;

import fr.brio.devoirs.domain.Devoir;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DevoirRepository extends JpaRepository<Devoir, UUID> {

    List<Devoir> findByClasseIdInAndStatut(Collection<UUID> classeIds, String statut);

    /** Tous les devoirs d'une classe, du plus proche au plus lointain (vue enseignant). */
    List<Devoir> findByClasseIdOrderByEcheanceAtAsc(UUID classeId);

    /** Les devoirs publiés d'une classe de l'élève qui contiennent l'exercice soumis. */
    @Query(
            "select d from Devoir d join d.exerciceIds e "
                    + "where e = :exerciceId and d.classeId in :classeIds and d.statut = 'publie'")
    List<Devoir> findPubliesAvecExercice(
            @Param("exerciceId") UUID exerciceId, @Param("classeIds") Collection<UUID> classeIds);

    /** Les contrôles publiés d'une classe de l'élève actuellement ouverts (mode contrôle, ADR 0025). */
    @Query(
            "select d from Devoir d where d.type = 'controle' and d.statut = 'publie' "
                    + "and d.classeId in :classeIds and d.ouvreAt <= :maintenant "
                    + "and d.echeanceAt >= :maintenant order by d.echeanceAt asc")
    List<Devoir> findControlesOuverts(
            @Param("classeIds") Collection<UUID> classeIds, @Param("maintenant") Instant maintenant);
}
