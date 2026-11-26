package fr.brio.exercices.rediges;

import java.time.OffsetDateTime;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class ExercicesRedigesRepository {
    private static final String DEFINITIONS = """
            SELECT id, version, cours_id, auteur_id, titre, enonce, reponse_attendue, corrige,
                   echeance, publie_at, cloture_at
            FROM exercices.rediges_definitions
            """;
    private static final RowMapper<ExerciceRedige> DEFINITION = (rs, row) -> new ExerciceRedige(
            rs.getObject("id", UUID.class), rs.getInt("version"), rs.getObject("cours_id", UUID.class),
            rs.getObject("auteur_id", UUID.class), null, null, null, rs.getString("titre"),
            rs.getString("enonce"), rs.getString("reponse_attendue"), rs.getString("corrige"),
            instant(rs.getObject("echeance", OffsetDateTime.class)),
            instant(rs.getObject("publie_at", OffsetDateTime.class)),
            instant(rs.getObject("cloture_at", OffsetDateTime.class)));

    private final JdbcClient jdbc;

    ExercicesRedigesRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    Optional<ExerciceRedige> trouver(UUID id) {
        return jdbc.sql(DEFINITIONS + "WHERE id = :id").param("id", id).query(DEFINITION).optional();
    }

    Optional<ExerciceRedige> verrouiller(UUID id) {
        return jdbc.sql(DEFINITIONS + "WHERE id = :id FOR UPDATE")
                .param("id", id).query(DEFINITION).optional();
    }

    List<ExerciceRedige> pourCours(UUID coursId) {
        return jdbc.sql(DEFINITIONS + "WHERE cours_id = :cours AND publie_at IS NOT NULL ORDER BY publie_at, id")
                .param("cours", coursId).query(DEFINITION).list();
    }

    List<ExerciceRedige> pourAuteur(UUID auteurId) {
        return jdbc.sql(DEFINITIONS + "WHERE auteur_id = :auteur ORDER BY modifie_at DESC, id")
                .param("auteur", auteurId).query(DEFINITION).list();
    }

    void creer(ExerciceRedige e, Instant instant) {
        champs(jdbc.sql("""
                INSERT INTO exercices.rediges_definitions
                    (id, cours_id, auteur_id, version, titre, enonce, reponse_attendue, corrige, echeance, modifie_at)
                VALUES (:id, :cours, :auteur, :version, :titre, :enonce, :attendue, :corrige, :echeance, :instant)
                """), e, instant).param("auteur", e.auteurId()).param("version", e.version()).update();
    }

    void enregistrer(ExerciceRedige e, Instant instant) {
        champs(jdbc.sql("""
                UPDATE exercices.rediges_definitions
                SET cours_id = :cours, titre = :titre, enonce = :enonce,
                    reponse_attendue = :attendue, corrige = :corrige, echeance = :echeance, modifie_at = :instant
                WHERE id = :id
                """), e, instant).update();
    }

    void publier(UUID id, Instant instant) {
        jdbc.sql("""
                UPDATE exercices.rediges_definitions SET publie_at = :instant, modifie_at = :instant WHERE id = :id
                """).param("instant", date(instant)).param("id", id).update();
    }

    void cloturer(UUID id, Instant instant) {
        jdbc.sql("""
                UPDATE exercices.rediges_definitions SET cloture_at = :instant, modifie_at = :instant WHERE id = :id
                """).param("instant", date(instant)).param("id", id).update();
    }

    private static JdbcClient.StatementSpec champs(JdbcClient.StatementSpec statement, ExerciceRedige e, Instant instant) {
        return statement.param("id", e.id()).param("cours", e.coursId()).param("titre", e.titre())
                .param("enonce", e.enonce()).param("attendue", e.reponseAttendue()).param("corrige", e.corrige())
                .param("echeance", date(e.echeance())).param("instant", date(instant));
    }

    Optional<Copie> copie(UUID exerciceId, UUID eleveId) {
        return jdbc.sql("""
                SELECT version, titre, enonce, corrige, reponse, correct, remis_at
                FROM exercices.rediges_soumissions
                WHERE exercice_id = :exercice AND eleve_id = :eleve ORDER BY version DESC LIMIT 1
                """).param("exercice", exerciceId).param("eleve", eleveId)
                .query((rs, row) -> new Copie(rs.getInt("version"), rs.getString("titre"), rs.getString("enonce"),
                        rs.getString("corrige"), rs.getString("reponse"), rs.getBoolean("correct"),
                        instant(rs.getObject("remis_at", OffsetDateTime.class))))
                .optional();
    }

    void soumettre(ExerciceRedige e, UUID eleveId, String reponse, boolean correct, Instant remisAt) {
        // A catalogue definition has no database row to lock. Its unique key makes a racing second
        // submit a no-op, then the following read returns the winner in either case.
        jdbc.sql("""
                INSERT INTO exercices.rediges_soumissions
                    (exercice_id, version, eleve_id, titre, enonce, corrige, reponse, correct, remis_at)
                VALUES (:exercice, :version, :eleve, :titre, :enonce, :corrige, :reponse, :correct, :remis)
                ON CONFLICT (exercice_id, version, eleve_id) DO NOTHING
                """).param("exercice", e.id()).param("version", e.version()).param("eleve", eleveId)
                .param("titre", e.titre()).param("enonce", e.enonce()).param("corrige", e.corrige())
                .param("reponse", reponse).param("correct", correct).param("remis", date(remisAt)).update();
    }

    private static Instant instant(OffsetDateTime date) {
        return date == null ? null : date.toInstant();
    }

    private static OffsetDateTime date(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    record Copie(int version, String titre, String enonce, String corrige, String reponse,
                 boolean correct, Instant remisAt) {}
}
