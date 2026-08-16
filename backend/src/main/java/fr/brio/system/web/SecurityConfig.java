package fr.brio.system.web;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                // OpenAPI spec and Swagger UI are accessible without auth (codegen + dev tooling)
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(withDefaults())
            // CSRF disabled — API is stateless basic auth, no session cookies
            // NOTE: when cookie-based auth is added, enable CSRF and coordinate with CorsConfig
            .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
