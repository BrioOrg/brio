package fr.brio.social.infrastructure;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Active la planification Spring pour le module {@code social} (purge de rétention, ADR 0023 §6) et
 * fournit l'horloge injectée dans les tâches datées, remplaçable dans les tests.
 */
@Configuration
@EnableScheduling
class SocialSchedulingConfiguration {

    @Bean
    @ConditionalOnMissingBean
    Clock clock() {
        return Clock.systemUTC();
    }
}
