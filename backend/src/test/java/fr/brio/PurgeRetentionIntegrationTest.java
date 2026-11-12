package fr.brio;

import static org.assertj.core.api.Assertions.assertThat;

import fr.brio.social.PurgeRetention;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Vérifie la purge de rétention (ADR 0023 §6) contre un vrai Postgres : au-delà de la fenêtre de
 * 12 mois, les contenus d'élèves sont anonymisés (auteur → compte anonyme) mais leur texte reste,
 * et les contenus récents ne bougent pas. Les lignes sont posées en SQL pour maîtriser {@code
 * created_at}.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class PurgeRetentionIntegrationTest {

    private static final UUID AUTEUR = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID ANONYME = PurgeRetention.COMPTE_ANONYME;

    private static final UUID FIL = UUID.fromString("f11a0000-0000-0000-0000-000000000001");
    private static final UUID SALON = UUID.fromString("5a100000-0000-0000-0000-000000000001");

    private static final UUID MSG_VIEUX = UUID.fromString("a0000000-0000-0000-0000-00000000000a");
    private static final UUID MSG_RECENT = UUID.fromString("a0000000-0000-0000-0000-00000000000b");
    private static final UUID SALON_MSG_VIEUX = UUID.fromString("b0000000-0000-0000-0000-00000000000a");
    private static final UUID SALON_MSG_RECENT = UUID.fromString("b0000000-0000-0000-0000-00000000000b");
    private static final UUID Q_VIEUX = UUID.fromString("c0000000-0000-0000-0000-00000000000a");
    private static final UUID Q_RECENT = UUID.fromString("c0000000-0000-0000-0000-00000000000b");
    private static final UUID REP_VIEUX = UUID.fromString("d0000000-0000-0000-0000-00000000000a");
    private static final UUID REP_RECENT = UUID.fromString("d0000000-0000-0000-0000-00000000000b");

    @Autowired PurgeRetention purgeRetention;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void poserDesContenus() {
        jdbc.update("DELETE FROM social.communaute_reponses");
        jdbc.update("DELETE FROM social.communaute_questions");
        jdbc.update("DELETE FROM social.salon_messages");
        jdbc.update("DELETE FROM social.salons");
        jdbc.update("DELETE FROM social.messages");
        jdbc.update("DELETE FROM social.fils");

        jdbc.update(
                "INSERT INTO social.fils (id, portee, portee_ref, classe_id, titre, auteur_id, created_at) "
                        + "VALUES (?, 'chapitre', 'ch-1', gen_random_uuid(), 'Fil', ?, now() - interval '13 months')",
                FIL, AUTEUR);
        jdbc.update(
                "INSERT INTO social.messages (id, fil_id, auteur_id, corps, marque_utile_at, marque_utile_par, created_at) "
                        + "VALUES (?, ?, ?, 'ancien message', now() - interval '13 months', ?, now() - interval '13 months')",
                MSG_VIEUX, FIL, AUTEUR, AUTEUR);
        jdbc.update(
                "INSERT INTO social.messages (id, fil_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'message recent', now() - interval '1 month')",
                MSG_RECENT, FIL, AUTEUR);

        jdbc.update(
                "INSERT INTO social.salons (id, classe_id, titre, cree_par, created_at) "
                        + "VALUES (?, gen_random_uuid(), 'Salon', ?, now() - interval '13 months')",
                SALON, AUTEUR);
        jdbc.update(
                "INSERT INTO social.salon_messages (id, salon_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'ancien salon', now() - interval '13 months')",
                SALON_MSG_VIEUX, SALON, AUTEUR);
        jdbc.update(
                "INSERT INTO social.salon_messages (id, salon_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, 'salon recent', now() - interval '1 month')",
                SALON_MSG_RECENT, SALON, AUTEUR);

        jdbc.update(
                "INSERT INTO social.communaute_questions (id, auteur_id, titre, corps, matiere, created_at) "
                        + "VALUES (?, ?, 'ancienne question', '[]'::jsonb, 'maths', now() - interval '13 months')",
                Q_VIEUX, AUTEUR);
        jdbc.update(
                "INSERT INTO social.communaute_questions (id, auteur_id, titre, corps, matiere, created_at) "
                        + "VALUES (?, ?, 'question recente', '[]'::jsonb, 'maths', now() - interval '1 month')",
                Q_RECENT, AUTEUR);
        jdbc.update(
                "INSERT INTO social.communaute_reponses (id, question_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, '[]'::jsonb, now() - interval '13 months')",
                REP_VIEUX, Q_RECENT, AUTEUR);
        jdbc.update(
                "INSERT INTO social.communaute_reponses (id, question_id, auteur_id, corps, created_at) "
                        + "VALUES (?, ?, ?, '[]'::jsonb, now() - interval '1 month')",
                REP_RECENT, Q_RECENT, AUTEUR);
    }

    private UUID auteurDe(String table, UUID id) {
        return jdbc.queryForObject(
                "SELECT auteur_id FROM social." + table + " WHERE id = ?", UUID.class, id);
    }

    @Test
    void anonymiseLesContenusAuDelaDeLaFenetreEtGardeLeTexte() {
        PurgeRetention.Resultat resultat = purgeRetention.purger();

        assertThat(resultat.messagesEntraide()).isEqualTo(1);
        assertThat(resultat.messagesSalon()).isEqualTo(1);
        assertThat(resultat.questions()).isEqualTo(1);
        assertThat(resultat.reponses()).isEqualTo(1);

        // Auteurs anciens coupés, auteurs récents intacts.
        assertThat(auteurDe("messages", MSG_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("messages", MSG_RECENT)).isEqualTo(AUTEUR);
        assertThat(auteurDe("salon_messages", SALON_MSG_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("salon_messages", SALON_MSG_RECENT)).isEqualTo(AUTEUR);
        assertThat(auteurDe("communaute_questions", Q_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("communaute_questions", Q_RECENT)).isEqualTo(AUTEUR);
        assertThat(auteurDe("communaute_reponses", REP_VIEUX)).isEqualTo(ANONYME);
        assertThat(auteurDe("communaute_reponses", REP_RECENT)).isEqualTo(AUTEUR);

        // La donnée d'identification « marqué utile par » est coupée elle aussi.
        assertThat(jdbc.queryForObject(
                        "SELECT marque_utile_par FROM social.messages WHERE id = ?", UUID.class, MSG_VIEUX))
                .isEqualTo(ANONYME);

        // Le texte reste (le fil garde son sens).
        assertThat(jdbc.queryForObject(
                        "SELECT corps FROM social.messages WHERE id = ?", String.class, MSG_VIEUX))
                .isEqualTo("ancien message");
    }

    @Test
    void estIdempotent() {
        assertThat(purgeRetention.purger().total()).isEqualTo(4);
        // Deuxième passe : plus rien à anonymiser.
        assertThat(purgeRetention.purger().total()).isZero();
    }
}
