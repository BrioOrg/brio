package fr.brio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.contenu.ContenuService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import org.springframework.security.test.context.support.WithMockUser;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@WithMockUser
@Import(TestcontainersConfiguration.class)
class ChapitreIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ContenuService contenuService;
    @Autowired ObjectMapper objectMapper;

    @BeforeEach
    void seedChapter() throws Exception {
        try (var is = getClass().getResourceAsStream("/contenu/seeds/pythagore-3e.json")) {
            JsonNode doc = objectMapper.readTree(is);
            contenuService.ingestChapitre(doc); // idempotent — skips if already present
        }
    }

    @Test
    void shouldReturnSeededChapter() throws Exception {
        mockMvc.perform(get("/api/chapitres/theoreme-de-pythagore")
                        )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("theoreme-de-pythagore"))
                .andExpect(jsonPath("$.title").exists())
                .andExpect(jsonPath("$.sections").isArray());
    }

    @Test
    void shouldReturn404ForUnknownChapter() throws Exception {
        mockMvc.perform(get("/api/chapitres/does-not-exist")
                        )
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldNeverLeakAnswerFieldsInChapterResponse() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/chapitres/theoreme-de-pythagore")
                        )
                .andExpect(status().isOk())
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        ContenuService.SENSITIVE_EVAL_FIELDS.forEach(field ->
                assertThat(containsKey(response, field))
                        .as("Field '%s' must never appear in the chapter response served to clients", field)
                        .isFalse()
        );
    }

    private boolean containsKey(JsonNode node, String key) {
        if (node.isObject()) {
            if (node.has(key)) return true;
            for (var child : node) {
                if (containsKey(child, key)) return true;
            }
        } else if (node.isArray()) {
            for (var child : node) {
                if (containsKey(child, key)) return true;
            }
        }
        return false;
    }
}
