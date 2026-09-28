package fr.brio.identite.infrastructure;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sends through a real Mailpit — the SMTP server of the deployed environment (ADR 0024 §6)
 * — and reads the result back through Mailpit's API, as a person would in its UI.
 */
@Testcontainers
class SmtpEmailSenderIntegrationTest {

    @Container
    static final GenericContainer<?> mailpit = new GenericContainer<>("axllent/mailpit:v1.27")
            .withExposedPorts(1025, 8025)
            .waitingFor(Wait.forHttp("/api/v1/messages").forPort(8025));

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();
    private SmtpEmailSender sender;

    @BeforeEach
    void setup() throws Exception {
        var mailSender = new JavaMailSenderImpl();
        mailSender.setHost(mailpit.getHost());
        mailSender.setPort(mailpit.getMappedPort(1025));
        sender = new SmtpEmailSender(mailSender, "Brio <no-reply@brio.test>");

        http.send(HttpRequest.newBuilder(mailpitApi("/api/v1/messages")).DELETE().build(),
                HttpResponse.BodyHandlers.discarding());
    }

    @Test
    void shouldDeliverConsentRequestWithTheConfirmationLink() throws Exception {
        String url = "https://brio.test/consentement/AbC-123_xyz";

        sender.sendConsentEmail("parent@example.fr", url);

        JsonNode message = onlyMessage();
        assertThat(message.path("From").path("Address").asText()).isEqualTo("no-reply@brio.test");
        assertThat(message.path("From").path("Name").asText()).isEqualTo("Brio");
        assertThat(message.path("To").get(0).path("Address").asText()).isEqualTo("parent@example.fr");
        assertThat(message.path("Subject").asText())
                .isEqualTo("Brio — autorisez le compte de votre enfant");
        assertThat(message.path("Text").asText())
                .contains(url)
                .contains("responsable légal")
                .contains("expire dans 7 jours");
    }

    @Test
    void shouldDeliverConfirmationWithTheRevocationLink() throws Exception {
        String url = "https://brio.test/consentement/revocation/AbC-123_xyz";

        sender.sendConsentConfirmationEmail("parent@example.fr", url);

        JsonNode message = onlyMessage();
        assertThat(message.path("To").get(0).path("Address").asText()).isEqualTo("parent@example.fr");
        assertThat(message.path("Subject").asText())
                .isEqualTo("Brio — le compte de votre enfant est activé");
        assertThat(message.path("Text").asText())
                .contains(url)
                .contains("immédiatement suspendu");
    }

    private JsonNode onlyMessage() throws Exception {
        JsonNode list = get("/api/v1/messages");
        assertThat(list.path("messages")).hasSize(1);
        return get("/api/v1/message/" + list.path("messages").get(0).path("ID").asText());
    }

    private JsonNode get(String path) throws Exception {
        var response = http.send(HttpRequest.newBuilder(mailpitApi(path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
        return json.readTree(response.body());
    }

    private static URI mailpitApi(String path) {
        return URI.create("http://" + mailpit.getHost() + ":" + mailpit.getMappedPort(8025) + path);
    }
}
