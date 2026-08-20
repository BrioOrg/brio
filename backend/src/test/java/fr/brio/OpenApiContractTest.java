package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class OpenApiContractTest {

    @Autowired MockMvc mockMvc;

    @Test
    void openApiContractMatchesCommitted() throws Exception {
        String actualJson = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonMapper sortingMapper = JsonMapper.builder()
                .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
                .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .enable(SerializationFeature.INDENT_OUTPUT)
                .build();

        JsonNode actualNode = sortingMapper.readTree(actualJson);
        String sortedActual = sortingMapper.writeValueAsString(actualNode);

        Path targetDir = Paths.get("target");
        Files.createDirectories(targetDir);
        Files.writeString(targetDir.resolve("openapi-actual.json"), sortedActual + "\n");

        Path contractFile = Paths.get("../docs/api/openapi.json");
        if (!Files.exists(contractFile)) {
            fail("Contract file missing — copy target/openapi-actual.json to docs/api/openapi.json");
        }

        ObjectMapper plainMapper = new ObjectMapper();
        JsonNode committedNode = plainMapper.readTree(contractFile.toFile());
        JsonNode actualNodeForComparison = plainMapper.readTree(actualJson);

        assertThat(actualNodeForComparison)
                .as("OpenAPI contract has drifted from docs/api/openapi.json.\n"
                        + "Run: diff docs/api/openapi.json target/openapi-actual.json\n"
                        + "If the change is intentional: cp backend/target/openapi-actual.json docs/api/openapi.json")
                .isEqualTo(committedNode);
    }
}
