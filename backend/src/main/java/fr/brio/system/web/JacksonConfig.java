package fr.brio.system.web;

import com.fasterxml.jackson.databind.DeserializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class JacksonConfig {

    @Bean
    Jackson2ObjectMapperBuilderCustomizer strictDeserialization() {
        // Reject unknown JSON fields globally — unknown fields signal client drift or API misuse.
        // DTOs that intentionally allow extras can use @JsonIgnoreProperties(ignoreUnknown = true).
        return builder -> builder.featuresToEnable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }
}
