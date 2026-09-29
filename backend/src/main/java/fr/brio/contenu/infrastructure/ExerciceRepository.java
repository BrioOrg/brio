package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Exercice;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExerciceRepository extends JpaRepository<Exercice, UUID> {

    Optional<Exercice> findByChapitreIdAndSlug(String chapitreId, String slug);

    List<Exercice> findByChapitreId(String chapitreId);

    List<Exercice> findByCoursId(UUID coursId);

    /**
     * Exercices d'annales (chapitres présents dans contenu.annales) portant la compétence donnée,
     * hors exercices retirés. Sert à l'entraînement ciblé par compétence (F7, ADR 0026).
     */
    @Query(value = """
            SELECT e.* FROM contenu.exercices e
            JOIN contenu.annales a ON a.chapitre_id = e.chapitre_id
            WHERE :code = ANY (e.competencies) AND e.retired_at IS NULL
            """, nativeQuery = true)
    List<Exercice> findAnnaleExercicesByCompetence(@Param("code") String code);
}
