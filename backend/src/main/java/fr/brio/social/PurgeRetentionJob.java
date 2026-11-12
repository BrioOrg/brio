package fr.brio.social;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Déclencheur planifié de la purge de rétention (ADR 0023 §6).
 *
 * <p>Séparé de {@link PurgeRetention} pour que la logique reste testable sans planification. Le
 * bean n'existe que si {@code brio.social.retention.active} est vrai (défaut), ce qui permet de
 * couper complètement la tâche par configuration — « branché au déploiement avec le reste de la
 * rétention » (ADR 0023 §6). La cadence est configurable via {@code brio.social.retention.cron}
 * (par défaut, tous les jours à 03h30).
 */
@Component
@ConditionalOnProperty(
        prefix = "brio.social.retention",
        name = "active",
        havingValue = "true",
        matchIfMissing = true)
class PurgeRetentionJob {

    private final PurgeRetention purgeRetention;

    PurgeRetentionJob(PurgeRetention purgeRetention) {
        this.purgeRetention = purgeRetention;
    }

    @Scheduled(cron = "${brio.social.retention.cron:0 30 3 * * *}", zone = "${brio.social.retention.zone:Europe/Paris}")
    void purgeProgrammee() {
        purgeRetention.purger();
    }
}
