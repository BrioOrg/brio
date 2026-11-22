package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.brio.social.domain.ModerationPreventive;
import org.junit.jupiter.api.Test;

class ModerationPreventiveTest {

    @Test
    void should_trim_and_accept_a_normal_message() {
        assertThat(ModerationPreventive.valider("  bonjour, je bloque sur le 3  "))
                .isEqualTo("bonjour, je bloque sur le 3");
    }

    @Test
    void should_reject_an_empty_message() {
        assertThatThrownBy(() -> ModerationPreventive.valider("   "))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void should_reject_a_message_that_is_too_long() {
        String trop = "a".repeat(ModerationPreventive.LONGUEUR_MAX + 1);
        assertThatThrownBy(() -> ModerationPreventive.valider(trop))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void should_reject_an_http_link() {
        assertThatThrownBy(() -> ModerationPreventive.valider("regarde http://triche.fr/corrige"))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void should_reject_a_www_link() {
        assertThatThrownBy(() -> ModerationPreventive.valider("va sur www.corrige.fr"))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void should_reject_a_link_with_a_message_that_fits_every_surface() {
        assertThatThrownBy(() -> ModerationPreventive.valider("regarde http://triche.fr"))
                .hasMessage("Les liens externes ne sont pas autorisés.");
    }

    @Test
    void should_reject_a_french_phone_number() {
        assertThatThrownBy(() -> ModerationPreventive.valider("appelle-moi au 06 12 34 56 78"))
                .isInstanceOf(MessageInvalideException.class)
                .hasMessage("Les numéros de téléphone ne sont pas autorisés.");
        assertThatThrownBy(() -> ModerationPreventive.valider("mon num +33612345678"))
                .isInstanceOf(MessageInvalideException.class);
        assertThatThrownBy(() -> ModerationPreventive.valider("0612.34.56.78 le soir"))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void should_keep_dates_years_and_decimals() {
        assertThat(ModerationPreventive.valider("le contrôle du 01.01.2024, exercice 2024 : 0,5 + 1,25"))
                .isEqualTo("le contrôle du 01.01.2024, exercice 2024 : 0,5 + 1,25");
    }
}
