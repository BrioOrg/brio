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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
        try (var is = getClass().getResourceAsStream(
                "/contenu/chapitres/3e/mathematiques/theoreme-de-pythagore.json")) {
            JsonNode doc = objectMapper.readTree(is);
            contenuService.ingestChapitre(doc); // idempotent — skips if already present
        }
    }

    @Test
    void shouldReturnChapterByTripletPath() throws Exception {
        mockMvc.perform(get("/api/chapitres/3e/mathematiques/theoreme-de-pythagore"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("theoreme-de-pythagore"))
                .andExpect(jsonPath("$.title").exists())
                .andExpect(jsonPath("$.sections").isArray());
    }

    @Test
    void shouldRedirectLegacyIdPathWithPermanentRedirect() throws Exception {
        mockMvc.perform(get("/api/chapitres/theoreme-de-pythagore"))
                .andExpect(status().isPermanentRedirect())
                .andExpect(header().string(
                        "Location", "/api/chapitres/3e/mathematiques/theoreme-de-pythagore"));
    }

    @Test
    void shouldReturn404ForUnknownTriplet() throws Exception {
        mockMvc.perform(get("/api/chapitres/3e/mathematiques/does-not-exist"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturn404ForUnknownLegacyId() throws Exception {
        mockMvc.perform(get("/api/chapitres/does-not-exist"))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldReturnCatalogueWithPublishedChapter() throws Exception {
        mockMvc.perform(get("/api/catalogue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].niveauCode").value("3e"))
                .andExpect(jsonPath("$[0].matieres[0].matiereCode").value("mathematiques"))
                .andExpect(jsonPath("$[0].matieres[0].chapitres[0].slug")
                        .value("theoreme-de-pythagore"));
    }

    @Test
    void shouldNeverLeakAnswerFieldsInChapterResponse() throws Exception {
        MvcResult result = mockMvc.perform(
                        get("/api/chapitres/3e/mathematiques/theoreme-de-pythagore"))
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
