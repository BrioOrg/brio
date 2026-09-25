package fr.brio.system.web;

import fr.brio.identite.CompteService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
class SecurityConfig {

    // Catch-all chain: matches any request, so Spring Security requires it to be
    // registered last (lowest precedence). The local-only chain below runs first.
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    SecurityFilterChain filterChain(HttpSecurity http,
                                    AuthenticationSuccessHandler loginSuccess,
                                    AuthenticationFailureHandler loginFailure,
                                    LogoutSuccessHandler logoutSuccess,
                                    CompteService compteService) throws Exception {
        var csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null); // always populate the attribute

        var statutCheck = new StatutCheckFilter(compteService);

        http
            .cors(withDefaults())
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .csrfTokenRequestHandler(csrfHandler)
                // Consent endpoints are protected by their own bearer tokens; no CSRF cookie needed.
                // POST /api/comptes (signup) and POST /api/classes/rejoindre have no session to protect.
                .ignoringRequestMatchers(
                        AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/comptes"),
                        AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/comptes/eleve"),
                        AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/consentements/*/validation"),
                        AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/consentements/revocation/*"),
                        AntPathRequestMatcher.antMatcher(HttpMethod.POST, "/api/classes/rejoindre")))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Catalogue and chapter content are public — CDC §5: "un compte en attente peut
                // lire le catalogue public et rien d'autre". The tutor and submissions remain gated.
                .requestMatchers(HttpMethod.GET, "/api/catalogue").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/chapitres/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/sessions").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/comptes").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/comptes/eleve").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/consentements/*/validation").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/consentements/revocation/*").permitAll()
                .requestMatchers(HttpMethod.DELETE, "/api/comptes/*/consentement")
                        .hasAnyRole("ADMIN_BRIO", "ADMIN_ETAB")
                // Class code enrollment: public (convention gate enforced in the service)
                .requestMatchers(HttpMethod.POST, "/api/classes/rejoindre").permitAll()
                // Teacher course authoring (create/save/scope/publish): ENSEIGNANT only.
                .requestMatchers("/api/prof/**").hasRole("ENSEIGNANT")
                // Class and établissement management: ADMIN_BRIO only
                .requestMatchers(HttpMethod.POST, "/api/etablissements").hasRole("ADMIN_BRIO")
                .requestMatchers(HttpMethod.POST, "/api/classes").hasRole("ADMIN_BRIO")
                .requestMatchers(HttpMethod.POST, "/api/classes/*/codes").hasRole("ADMIN_BRIO")
                .anyRequest().authenticated())
            .formLogin(form -> form
                .loginProcessingUrl("/api/sessions")
                .usernameParameter("identifiant")
                .passwordParameter("mot_de_passe")
                .successHandler(loginSuccess)
                .failureHandler(loginFailure)
                .permitAll())
            .logout(logout -> logout
                .logoutRequestMatcher(req -> "DELETE".equals(req.getMethod())
                        && "/api/sessions".equals(req.getRequestURI()))
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID")
                .logoutSuccessHandler(logoutSuccess))
            .sessionManagement(session -> session
                .maximumSessions(5))
            .addFilterAfter(statutCheck, UsernamePasswordAuthenticationFilter.class)
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((req, res, e) ->
                        res.sendError(HttpServletResponse.SC_UNAUTHORIZED))
                .accessDeniedHandler((req, res, e) ->
                        res.sendError(HttpServletResponse.SC_FORBIDDEN)));

        return http.build();
    }

    // Local-only chain for actuator + API docs behind HTTP Basic. Scoped via
    // securityMatcher, so it must be ordered before the catch-all chain above.
    @Bean
    @Profile("local")
    @Order(1)
    SecurityFilterChain localHttpBasicChain(HttpSecurity http) throws Exception {
        http
            .securityMatcher("/actuator/**", "/v3/api-docs/**", "/swagger-ui/**")
            .httpBasic(withDefaults())
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth.anyRequest().authenticated());
        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        // DelegatingPasswordEncoder stores the algorithm prefix ({bcrypt}) in the hash,
        // making future algorithm migration a config change with on-login rehashing.
        // Strength 12 intentionally higher than Spring's default 10 — override to 4 in tests.
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    AuthenticationFailureHandler loginFailureHandler() {
        return (req, res, ex) -> {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"error\":\"Identifiant ou mot de passe incorrect\"}");
        };
    }

    @Bean
    LogoutSuccessHandler logoutSuccessHandler() {
        return (req, res, auth) -> res.setStatus(HttpServletResponse.SC_NO_CONTENT);
    }
}
