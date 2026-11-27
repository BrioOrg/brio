package fr.brio.exercices.rediges;

import fr.brio.exercices.rediges.ExerciceRedige.ModeCorrection;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.RetourCopie;
import java.time.OffsetDateTime;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class ExercicesRedigesRepository {
    private static final String DEFINITIONS = """
            SELECT id, version, cours_id, auteur_id, titre, enonce, reponse_attendue, corrige,
                   mode_correction, photo_autorisee, copie_modele, echeance, publie_at, cloture_at
            FROM exercices.rediges_definitions
            """;
    private static final RowMapper<ExerciceRedige> DEFINITION = (rs, row) -> new ExerciceRedige(
            rs.getObject("id", UUID.class), rs.getInt("version"), rs.getObject("cours_id", UUID.class),
            rs.getObject("auteur_id", UUID.class), null, null, null, rs.getString("titre"),
            rs.getString("enonce"), rs.getString("reponse_attendue"), rs.getString("corrige"),
            ModeCorrection.valueOf(rs.getString("mode_correction")), rs.getBoolean("photo_autorisee"),
            rs.getString("copie_modele"),
            instant(rs.getObject("echeance", OffsetDateTime.class)),
            instant(rs.getObject("publie_at", OffsetDateTime.class)),
            instant(rs.getObject("cloture_at", OffsetDateTime.class)));

    private static final String COPIES = """
            SELECT s.version, s.eleve_id, s.titre, s.enonce, s.corrige, s.copie_modele,
                   s.reponse, s.correct, s.remis_at, s.retour_commentaire, s.retour_publie_at,
                   EXISTS (SELECT 1 FROM exercices.rediges_photos p
                           WHERE (p.exercice_id, p.version, p.eleve_id) =
                                 (s.exercice_id, s.version, s.eleve_id)) AS photo
            FROM exercices.rediges_soumissions s
            """;
    private static final RowMapper<Copie> COPIE = (rs, row) -> {
        Instant retourPublie = instant(rs.getObject("retour_publie_at", OffsetDateTime.class));
        RetourCopie retour = retourPublie == null ? null : new RetourCopie(rs.getString("retour_commentaire"), retourPublie);
        return new Copie(rs.getInt("version"), rs.getObject("eleve_id", UUID.class),
                rs.getString("titre"), rs.getString("enonce"), rs.getString("corrige"), rs.getString("copie_modele"),
                rs.getString("reponse"), rs.getObject("correct", Boolean.class),
                instant(rs.getObject("remis_at", OffsetDateTime.class)), rs.getBoolean("photo"), retour);
    };

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
                    (id, cours_id, auteur_id, version, titre, enonce, reponse_attendue, corrige,
                     mode_correction, photo_autorisee, copie_modele, echeance, modifie_at)
                VALUES (:id, :cours, :auteur, :version, :titre, :enonce, :attendue, :corrige,
                        :mode, :photoAutorisee, :copieModele, :echeance, :instant)
                """), e, instant).param("auteur", e.auteurId()).param("version", e.version()).update();
    }

    void enregistrer(ExerciceRedige e, Instant instant) {
        champs(jdbc.sql("""
                UPDATE exercices.rediges_definitions
                SET cours_id = :cours, titre = :titre, enonce = :enonce,
                    reponse_attendue = :attendue, corrige = :corrige, mode_correction = :mode,
                    photo_autorisee = :photoAutorisee, copie_modele = :copieModele,
                    echeance = :echeance, modifie_at = :instant
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
                .param("mode", e.modeCorrection().name()).param("photoAutorisee", e.photoAutorisee())
                .param("copieModele", e.copieModele())
                .param("echeance", date(e.echeance())).param("instant", date(instant));
    }

    Optional<Copie> copie(UUID exerciceId, UUID eleveId) {
        return jdbc.sql(COPIES + """
                WHERE s.exercice_id = :exercice AND s.eleve_id = :eleve ORDER BY s.version DESC LIMIT 1
                """).param("exercice", exerciceId).param("eleve", eleveId).query(COPIE)
                .optional();
    }

    List<Copie> copiesPourRevue(UUID exerciceId, int version, Set<UUID> eleves) {
        if (eleves.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(COPIES + """
                WHERE s.exercice_id = :exercice AND s.version = :version AND s.eleve_id IN (:eleves)
                ORDER BY s.remis_at DESC, s.eleve_id
                """).param("exercice", exerciceId).param("version", version).param("eleves", eleves)
                .query(COPIE).list();
    }

    void soumettre(ExerciceRedige e, UUID eleveId, String reponse, Boolean correct, Instant remisAt, PhotoCopie photo) {
        // A catalogue definition has no database row to lock. Its unique key makes a racing second
        // submit a no-op, then the following read returns the winner in either case.
        int inserees = jdbc.sql("""
                INSERT INTO exercices.rediges_soumissions
                    (exercice_id, version, eleve_id, titre, enonce, corrige, copie_modele, reponse, correct, remis_at)
                VALUES (:exercice, :version, :eleve, :titre, :enonce, :corrige, :copieModele, :reponse, :correct, :remis)
                ON CONFLICT (exercice_id, version, eleve_id) DO NOTHING
                """).param("exercice", e.id()).param("version", e.version()).param("eleve", eleveId)
                .param("titre", e.titre()).param("enonce", e.enonce()).param("corrige", e.corrige())
                .param("copieModele", e.copieModele())
                .param("reponse", reponse).param("correct", correct).param("remis", date(remisAt)).update();
        if (inserees == 1 && photo != null) {
            jdbc.sql("""
                    INSERT INTO exercices.rediges_photos (exercice_id, version, eleve_id, content_type, contenu)
                    VALUES (:exercice, :version, :eleve, :contentType, :contenu)
                    """).param("exercice", e.id()).param("version", e.version()).param("eleve", eleveId)
                    .param("contentType", photo.contentType()).param("contenu", photo.contenu()).update();
        }
    }

    Optional<PhotoCopie> photo(UUID exerciceId, int version, UUID eleveId) {
        return jdbc.sql("""
                SELECT content_type, contenu FROM exercices.rediges_photos
                WHERE exercice_id = :exercice AND version = :version AND eleve_id = :eleve
                """).param("exercice", exerciceId).param("version", version).param("eleve", eleveId)
                .query((rs, row) -> new PhotoCopie(rs.getString("content_type"), rs.getBytes("contenu"))).optional();
    }

    void publierRetour(UUID exerciceId, int version, UUID eleveId, String commentaire, Instant instant) {
        jdbc.sql("""
                UPDATE exercices.rediges_soumissions SET retour_commentaire = :commentaire, retour_publie_at = :instant
                WHERE exercice_id = :exercice AND version = :version AND eleve_id = :eleve
                """).param("exercice", exerciceId).param("version", version).param("eleve", eleveId)
                .param("commentaire", commentaire).param("instant", date(instant)).update();
    }

    private static Instant instant(OffsetDateTime date) {
        return date == null ? null : date.toInstant();
    }

    private static OffsetDateTime date(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    record Copie(int version, UUID eleveId, String titre, String enonce, String corrige, String copieModele,
                 String reponse, Boolean correct, Instant remisAt, boolean photo, RetourCopie retour) {}
}
