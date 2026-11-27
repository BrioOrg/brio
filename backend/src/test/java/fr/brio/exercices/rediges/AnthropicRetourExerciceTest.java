package fr.brio.exercices.rediges;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import fr.brio.exercices.rediges.RetourExerciceApi.Critere;
import fr.brio.exercices.rediges.RetourExerciceApi.Demande;
import fr.brio.exercices.rediges.RetourExerciceApi.Etat;
import fr.brio.exercices.rediges.RetourExerciceApi.Verdict;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class AnthropicRetourExerciceTest {
    private final ObjectMapper json = new ObjectMapper();
    private final Demande demande = new Demande("Nomme deux conditions.", 2,
            List.of(new Critere("Libre entrée", List.of()), new Critere("Homogénéité", List.of())), null,
            "Les entreprises peuvent entrer librement.");

    @Test
    void accepteLesExtraitsLitterauxEtRemetLesCriteresEnOrdre() throws Exception {
        var result = AnthropicRetourExercice.valider(demande, json.readTree(tool("""
                {"critere":2,"etat":"incertain","extrait":""},
                {"critere":1,"etat":"present","extrait":"entrer librement"}
                """))).orElseThrow();
        assertThat(result.verdicts()).containsExactly(
                new Verdict(1, Etat.present, "entrer librement"), new Verdict(2, Etat.incertain, ""));
        assertThat(result.tokensEntree()).isEqualTo(23);
        assertThat(result.tokensSortie()).isEqualTo(15);
    }

    @Test
    void refuseUnExtraitInventeOuUnCritereDuplique() throws Exception {
        for (String verdicts : List.of("""
                {"critere":1,"etat":"present","extrait":"les produits sont identiques"},
                {"critere":2,"etat":"manquant","extrait":""}
                """, """
                {"critere":1,"etat":"present","extrait":"entrer librement"},
                {"critere":1,"etat":"manquant","extrait":""}
                """, """
                {"critere":1,"etat":"present","extrait":"entrer librement"},
                {"critere":2,"etat":"incertain","extrait":"Les entreprises"}
                """, """
                {"critere":1,"etat":"present","extrait":"entrer librement"}
                """)) {
            assertThat(AnthropicRetourExercice.valider(demande, json.readTree(tool(verdicts)))).isEmpty();
        }
    }

    @Test
    void transmetLaCleCompacteSansInclureLesCoordonneesNiRelancer() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var calls = new AtomicInteger();
        var sent = new AtomicReference<JsonNode>();
        var response = tool("""
                {"critere":1,"etat":"present","extrait":"entrer librement"},
                {"critere":2,"etat":"manquant","extrait":""}
                """).getBytes(StandardCharsets.UTF_8);
        server.createContext("/v1/messages", request -> {
            try (request) {
                calls.incrementAndGet();
                sent.set(json.readTree(request.getRequestBody()));
                request.sendResponseHeaders(200, response.length);
                request.getResponseBody().write(response);
            }
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            var disabled = new AnthropicRetourExercice(json, base, "test-key", "test-model", false);
            assertThat(disabled.evaluer(demande)).isEmpty();
            var provider = new AnthropicRetourExercice(json, base, "test-key", "test-model", true);
            assertThat(provider.evaluer(new Demande(demande.enonce(), 2, demande.criteres(), null,
                    "Suis-je sur alice@example.test ?"))).isEmpty();
            assertThat(calls.get()).isZero();
            assertThat(provider.evaluer(demande)).isPresent();
            assertThat(calls.get()).isEqualTo(1);
            var payload = sent.get();
            assertThat(payload.path("max_tokens").asInt()).isEqualTo(768);
            assertThat(payload.path("tool_choice").path("name").asText()).isEqualTo("verifier_criteres");
            var content = json.readTree(payload.path("messages").get(0).path("content").asText());
            assertThat(content.has("extraitLecon")).isFalse();
            assertThat(content.size()).isEqualTo(4);
            assertThat(content.path("reponse").asText()).isEqualTo(demande.reponse());
        } finally {
            server.stop(0);
        }
    }

    private static String tool(String verdicts) {
        return """
                {"stop_reason":"tool_use","content":[{"type":"tool_use","name":"verifier_criteres",
                "input":{"verdicts":[%s]}}], "usage":{"input_tokens":23,"output_tokens":15}}
                """.formatted(verdicts);
    }
}
