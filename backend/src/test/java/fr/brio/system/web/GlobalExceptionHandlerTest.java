package fr.brio.system.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * A bad request from the client must get a 4xx, not a 500 (#342). The advice is exercised against a
 * tiny probe controller so each standard Spring MVC failure can be triggered in isolation, with no
 * security or database in the way.
 */
class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new Sonde())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void malformedPathIdIs400() throws Exception {
        mockMvc.perform(get("/sonde/pas-un-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void missingRequiredParameterIs400() throws Exception {
        mockMvc.perform(get("/sonde"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void parameterOfTheWrongTypeIs400() throws Exception {
        mockMvc.perform(get("/sonde").param("page", "abc"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unsupportedMethodIs405() throws Exception {
        mockMvc.perform(delete("/sonde/{id}", UUID.randomUUID()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void unsupportedContentTypeIs415() throws Exception {
        mockMvc.perform(post("/sonde").contentType(MediaType.TEXT_PLAIN).content("coucou"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void anUnexpectedFailureStaysA500() throws Exception {
        mockMvc.perform(get("/sonde/casse"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Internal server error"));
    }

    @RestController
    static class Sonde {

        @GetMapping("/sonde/{id}")
        String parId(@PathVariable UUID id) {
            return "ok";
        }

        @GetMapping("/sonde")
        String parPage(@RequestParam int page) {
            return "ok";
        }

        @PostMapping(value = "/sonde", consumes = MediaType.APPLICATION_JSON_VALUE)
        String poster(@RequestBody String corps) {
            return "ok";
        }

        // A route that blows up server-side, to prove genuine 500s are untouched.
        @GetMapping("/sonde/casse")
        String casse() {
            throw new IllegalStateException("boom");
        }
    }
}
