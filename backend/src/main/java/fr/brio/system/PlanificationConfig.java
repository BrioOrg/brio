package fr.brio.system;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Application-wide scheduling and clock. Lives in {@code system} rather than in the first module
 * that needed it (the social retention purge, ADR 0023 §6): {@code @EnableScheduling} switches
 * scheduling on for the whole application, and one shared {@link Clock} bean avoids two modules
 * each declaring their own. Tests replace the clock by building the service with a fixed one.
 */
@Configuration
@EnableScheduling
class PlanificationConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
