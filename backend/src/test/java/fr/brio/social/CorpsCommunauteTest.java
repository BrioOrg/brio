package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.social.domain.CorpsCommunaute;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CorpsCommunauteTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static JsonNode lire(String corps) throws Exception {
        return JSON.readTree(corps);
    }

    @Test
    void shouldAcceptEveryBlockOfThePalette() throws Exception {
        JsonNode corps = lire("""
                [{"id":"a","type":"prose","text":"**Bonjour** $x$"},
                 {"id":"b","type":"formula","latex":"x^2","display":"block"},
                 {"id":"c","type":"code","code":"print(1)","language":"python"},
                 {"id":"d","type":"code","code":"dire (1)","language":"scratch"},
                 {"id":"e","type":"list","items":["un","deux"]}]
                """);

        assertThat(lire(CorpsCommunaute.valider(corps))).isEqualTo(corps);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        // Blocks of the course schema outside the palette, and unknown ones.
        "[{\"id\":\"a\",\"type\":\"image\",\"src\":\"https://x.test/a.png\"}]",
        "[{\"id\":\"a\",\"type\":\"table\",\"rows\":[]}]",
        "[{\"id\":\"a\",\"type\":\"heading\",\"text\":\"Titre\"}]",
        "[{\"id\":\"a\",\"type\":\"exercise\"}]",
        "[{\"id\":\"a\",\"type\":\"inconnu\"}]",
        // Not a list of blocks.
        "[]",
        "{\"id\":\"a\",\"type\":\"prose\",\"text\":\"x\"}",
        "\"texte\"",
        "[\"texte\"]",
        // Malformed blocks.
        "[{\"id\":\"a\",\"type\":\"prose\"}]",
        "[{\"id\":\"a\",\"type\":\"prose\",\"text\":\"  \"}]",
        "[{\"id\":\"a\",\"type\":\"prose\",\"text\":7}]",
        "[{\"type\":\"prose\",\"text\":\"x\"}]",
        "[{\"id\":\"PAS UN ID\",\"type\":\"prose\",\"text\":\"x\"}]",
        "[{\"id\":\"a\",\"type\":\"prose\",\"text\":\"x\"},{\"id\":\"a\",\"type\":\"prose\",\"text\":\"y\"}]",
        "[{\"id\":\"a\",\"type\":\"prose\",\"text\":\"x\",\"href\":\"https://x.test\"}]",
        "[{\"id\":\"a\",\"type\":\"formula\",\"latex\":\"x\",\"display\":\"geant\"}]",
        "[{\"id\":\"a\",\"type\":\"code\",\"code\":\"x\",\"language\":7}]",
        "[{\"id\":\"a\",\"type\":\"list\",\"items\":[]}]",
        "[{\"id\":\"a\",\"type\":\"list\",\"items\":[\"\"]}]",
        "[{\"id\":\"a\",\"type\":\"list\",\"items\":[{\"id\":\"b\"}]}]",
        // PostgreSQL refuses this character in a JSONB column.
        "[{\"id\":\"a\",\"type\":\"prose\",\"text\":\"x\\u0000y\"}]"
    })
    void shouldRejectABodyOutsideThePalette(String corps) throws Exception {
        assertThatThrownBy(() -> CorpsCommunaute.valider(lire(corps)))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void shouldRejectAMissingBody() {
        assertThatThrownBy(() -> CorpsCommunaute.valider(null)).isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void shouldRejectTooLongABody() throws Exception {
        String texte = "x".repeat(20_001);
        JsonNode corps = lire("[{\"id\":\"a\",\"type\":\"prose\",\"text\":\"" + texte + "\"}]");

        assertThatThrownBy(() -> CorpsCommunaute.valider(corps)).isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void shouldRejectTooManyBlocks() throws Exception {
        StringBuilder blocs = new StringBuilder();
        for (int i = 0; i < 51; i++) {
            blocs.append(i == 0 ? "" : ",").append("{\"id\":\"b").append(i).append("\",\"type\":\"prose\",\"text\":\"x\"}");
        }
        JsonNode corps = lire("[" + blocs + "]");

        assertThatThrownBy(() -> CorpsCommunaute.valider(corps)).isInstanceOf(MessageInvalideException.class);
    }
}
