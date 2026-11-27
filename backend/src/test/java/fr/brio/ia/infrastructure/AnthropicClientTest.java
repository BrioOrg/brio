package fr.brio.ia.infrastructure;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import fr.brio.ia.domain.TuteurIndisponibleException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.params.ParameterizedTest;
import java.util.stream.Stream;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class AnthropicClientTest {
    static Stream<Arguments> providerFailures() {
        return Stream.of(
                Arguments.of(401, """
                        {"error":{"message":"provider-private-detail"}}
                        """),
                Arguments.of(200, """
                        {"content":[{"type":"tool_use","name":"repondre","input":null}]}
                        """));
    }

    @ParameterizedTest
    @MethodSource("providerFailures")
    void unavailableProviderKeepsItsResponseOutOfTheError(int status, String body) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        byte[] response = body.getBytes(StandardCharsets.UTF_8);
        server.createContext("/v1/messages", request -> {
            try (request) {
                request.getRequestBody().readAllBytes();
                request.getResponseHeaders().set("Content-Type", "application/json");
                request.sendResponseHeaders(status, response.length);
                request.getResponseBody().write(response);
            }
        });
        server.start();
        try {
            var properties = new AnthropicProperties();
            properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            var client = new AnthropicClient(properties, new ObjectMapper());
            assertThatThrownBy(() -> client.ask("Synthetic instruction", "Example lesson", "Example question"))
                    .isInstanceOf(TuteurIndisponibleException.class)
                    .hasNoCause()
                    .hasMessageNotContaining("provider-private-detail");
        } finally {
            server.stop(0);
        }
    }
}
