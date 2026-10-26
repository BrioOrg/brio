package fr.brio;

import jakarta.servlet.http.Cookie;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Logs in through {@code POST /api/sessions} and returns the session cookie, the way a
 * browser holds a session. Sessions live in Spring Session's store (ADR 0034), which
 * resolves them from the cookie: a {@code MockHttpSession} passed to MockMvc is ignored.
 */
final class SessionCookies {

    static final String NAME = "JSESSIONID";

    private SessionCookies() {
    }

    static Cookie login(MockMvc mockMvc, String identifiant, String motDePasse) throws Exception {
        Cookie cookie = mockMvc.perform(post("/api/sessions")
                        .contentType("application/x-www-form-urlencoded")
                        .param("identifiant", identifiant)
                        .param("mot_de_passe", motDePasse)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie(NAME);
        assertThat(cookie).as("session cookie set on login").isNotNull();
        return cookie;
    }
}
