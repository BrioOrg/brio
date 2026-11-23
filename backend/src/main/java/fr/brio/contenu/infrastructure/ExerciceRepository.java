package fr.brio.contenu.infrastructure;

import fr.brio.contenu.domain.Chapitre;
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

    /** Every version of one teacher-course exercise: same course, same editor block id (slug). */
    List<Exercice> findByCoursIdAndSlug(UUID coursId, String slug);

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

    /**
     * Codes carried by at least one non-retired annale exercise: exactly the competencies for
     * which {@link #findAnnaleExercicesByCompetence} returns something (#406).
     */
    @Query(value = """
            SELECT DISTINCT c.code FROM contenu.exercices e
            JOIN contenu.annales a ON a.chapitre_id = e.chapitre_id
            CROSS JOIN LATERAL unnest(e.competencies) AS c(code)
            WHERE e.retired_at IS NULL
            """, nativeQuery = true)
    List<String> findAnnaleCompetenceCodes();

    /**
     * Published catalogue chapters (annales excluded) holding a non-retired exercise that carries
     * the competency, in catalogue order (niveau, matière, chapter order). Teacher courses are
     * excluded by the join on {@code chapitre_id}. Feeds the competency-to-lesson lookup (ADR 0043).
     */
    @Query(value = """
            SELECT c.* FROM contenu.chapitres c
            JOIN contenu.niveaux n ON n.code = c.niveau_code
            WHERE c.statut = 'published'
              AND NOT EXISTS (SELECT 1 FROM contenu.annales a WHERE a.chapitre_id = c.id)
              AND EXISTS (
                  SELECT 1 FROM contenu.exercices e
                  WHERE e.chapitre_id = c.id AND :code = ANY (e.competencies) AND e.retired_at IS NULL)
            ORDER BY n.ordre, c.matiere_code, c."ordre"
            """, nativeQuery = true)
    List<Chapitre> findPublishedChapitresByCompetence(@Param("code") String code);
}
