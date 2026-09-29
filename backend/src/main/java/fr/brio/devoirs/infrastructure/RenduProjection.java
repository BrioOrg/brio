package fr.brio.devoirs.infrastructure;

import fr.brio.devoirs.domain.DerivationRendu;
import fr.brio.devoirs.domain.Devoir;
import fr.brio.devoirs.domain.Rendu;
import fr.brio.devoirs.domain.RenduExercice;
import fr.brio.exercices.api.SoumissionEnregistree;
import fr.brio.identite.api.InscriptionsQuery;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Dérive les rendus des devoirs à partir des soumissions d'exercices (ADR 0020 §3).
 * {@code @ApplicationModuleListener} s'exécute après le commit de la transaction émettrice et est
 * persisté (rejouable après un crash), en gardant {@code devoirs} découplé d'{@code exercices}.
 * Idempotent : une re-livraison ou une nouvelle soumission met à jour la projection sans la fausser.
 */
@Component
class RenduProjection {

    private final DevoirRepository devoirs;
    private final RenduRepository rendus;
    private final RenduExerciceRepository renduExercices;
    private final InscriptionsQuery inscriptions;

    RenduProjection(
            DevoirRepository devoirs,
            RenduRepository rendus,
            RenduExerciceRepository renduExercices,
            InscriptionsQuery inscriptions) {
        this.devoirs = devoirs;
        this.rendus = rendus;
        this.renduExercices = renduExercices;
        this.inscriptions = inscriptions;
    }

    @ApplicationModuleListener
    void onSoumissionEnregistree(SoumissionEnregistree evenement) {
        Set<UUID> classes = inscriptions.classesDeLEleve(evenement.eleveId());
        if (classes.isEmpty()) {
            return;
        }
        for (Devoir devoir : devoirs.findPubliesAvecExercice(evenement.exerciceId(), classes)) {
            projeter(devoir, evenement);
        }
    }

    private void projeter(Devoir devoir, SoumissionEnregistree evenement) {
        Rendu rendu =
                rendus.findByDevoirIdAndEleveId(devoir.getId(), evenement.eleveId())
                        .orElseGet(() -> rendus.save(new Rendu(devoir.getId(), evenement.eleveId())));

        RenduExercice ligne =
                renduExercices
                        .findByRenduIdAndExerciceId(rendu.getId(), evenement.exerciceId())
                        .orElseGet(() -> new RenduExercice(rendu.getId(), evenement.exerciceId()));
        ligne.maj(evenement.correct(), evenement.score(), evenement.submittedAt());
        renduExercices.save(ligne);

        List<RenduExercice> lignes = renduExercices.findByRenduId(rendu.getId());
        DerivationRendu.Resultat resultat =
                DerivationRendu.deriver(
                        lignes.stream().map(RenduExercice::getScore).toList(), devoir.nombreExercices());
        Instant renduAt =
                DerivationRendu.RENDU.equals(resultat.statut())
                        ? lignes.stream()
                                .map(RenduExercice::getSubmittedAt)
                                .max(Comparator.naturalOrder())
                                .orElse(null)
                        : null;
        rendu.appliquer(resultat.statut(), resultat.score(), renduAt);
        rendus.save(rendu);
    }
}
