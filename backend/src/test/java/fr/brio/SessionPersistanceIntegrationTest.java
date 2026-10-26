package fr.brio;

import fr.brio.identite.domain.Compte;
import fr.brio.identite.infrastructure.CompteRepository;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sessions live in Postgres (ADR 0034): a real backend, stopped and started again on the
 * same database, still knows the session cookie it handed out. Real HTTP, real cookies —
 * MockMvc would never restart anything.
 */
class SessionPersistanceIntegrationTest {

    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg17").asCompatibleSubstituteFor("postgres"));

    private static final String CSRF = "csrf-" + UUID.randomUUID();

    private final HttpClient http = HttpClient.newHttpClient();

    @BeforeAll
    static void startDatabase() {
        POSTGRES.start();
    }

    @AfterAll
    static void stopDatabase() {
        POSTGRES.stop();
    }

    @Test
    void shouldKeepTheSessionAcrossABackendRestart() throws Exception {
        String sessionCookie;
        UUID compteId;
        try (var backend = startBackend()) {
            compteId = creerEnseignant(backend, "prof.redemarrage");
            sessionCookie = login(backend, "prof.redemarrage");
            assertThat(moi(backend, sessionCookie).statusCode()).isEqualTo(200);
        }

        try (var backend = startBackend()) {
            HttpResponse<String> moi = moi(backend, sessionCookie);
            assertThat(moi.statusCode()).isEqualTo(200);
            assertThat(moi.body()).contains(compteId.toString());

            // #279 unchanged: 12h of inactivity, renewed by every request.
            FindByIndexNameSessionRepository<? extends Session> sessions =
                    backend.getBean(FindByIndexNameSessionRepository.class);
            assertThat(sessions.findByPrincipalName(compteId.toString()).values())
                    .singleElement()
                    .extracting(Session::getMaxInactiveInterval)
                    .isEqualTo(Duration.ofHours(12));
        }
    }

    @Test
    void shouldTreatAnUnknownOrUnreadableSessionAsLoggedOut() throws Exception {
        try (var backend = startBackend()) {
            // A cookie the store does not know (expired, cleaned up, or from before ADR 0034).
            assertThat(moi(backend, "JSESSIONID=aW5jb25udWU").statusCode()).isEqualTo(401);

            // A session a later deploy can no longer deserialise: logged out, not an error.
            UUID compteId = creerEnseignant(backend, "prof.illisible");
            String sessionCookie = login(backend, "prof.illisible");
            int corrupted = backend.getBean(JdbcTemplate.class).update("""
                    UPDATE identite.spring_session_attributes a SET attribute_bytes = '\\x00'::bytea
                    FROM identite.spring_session s
                    WHERE a.session_primary_id = s.primary_id AND s.principal_name = ?""",
                    compteId.toString());
            assertThat(corrupted).isPositive();

            assertThat(moi(backend, sessionCookie).statusCode()).isEqualTo(401);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static ConfigurableApplicationContext startBackend() {
        // The test application.properties shadows the main one on the classpath: load the
        // main file explicitly, so the timeout and cookie checked are the deployed ones.
        // Command-line arguments outrank both files.
        return new SpringApplicationBuilder(BrioBackendApplication.class).run(
                "--spring.config.location=file:src/main/resources/application.properties,"
                        + "classpath:application.properties",
                "--server.port=0",
                "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                "--spring.datasource.username=" + POSTGRES.getUsername(),
                "--spring.datasource.password=" + POSTGRES.getPassword());
    }

    private static UUID creerEnseignant(ConfigurableApplicationContext backend, String identifiant) {
        return backend.getBean(CompteRepository.class).save(Compte.creerEnseignant(
                identifiant, "{noop}motdepasse", "Dupont", identifiant + "@test.fr")).getId();
    }

    /** Logs in and returns the {@code JSESSIONID=…} pair to send back. */
    private String login(ConfigurableApplicationContext backend, String identifiant)
            throws IOException, InterruptedException {
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(uri(backend, "/api/sessions"))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        // CookieCsrfTokenRepository compares the cookie with the header.
                        .header("Cookie", "XSRF-TOKEN=" + CSRF)
                        .header("X-XSRF-TOKEN", CSRF)
                        .POST(HttpRequest.BodyPublishers.ofString(
                                "identifiant=" + identifiant + "&mot_de_passe=motdepasse"))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(200);
        return response.headers().allValues("Set-Cookie").stream()
                .filter(c -> c.startsWith("JSESSIONID="))
                .map(c -> c.substring(0, c.indexOf(';')))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no session cookie on login"));
    }

    private HttpResponse<String> moi(ConfigurableApplicationContext backend, String sessionCookie)
            throws IOException, InterruptedException {
        return http.send(HttpRequest.newBuilder(uri(backend, "/api/moi"))
                        .header("Cookie", sessionCookie)
                        .GET()
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private static URI uri(ConfigurableApplicationContext backend, String path) {
        int port = ((ServletWebServerApplicationContext) backend).getWebServer().getPort();
        return URI.create("http://localhost:" + port + path);
    }
}
