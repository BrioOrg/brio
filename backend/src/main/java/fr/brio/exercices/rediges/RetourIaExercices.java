package fr.brio.exercices.rediges;

import fr.brio.exercices.rediges.ExercicesRedigesContrats.CritereEvalue;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.EtatRetourIa;
import fr.brio.exercices.rediges.ExercicesRedigesContrats.RetourIa;
import fr.brio.exercices.rediges.ExercicesRedigesRepository.Copie;
import fr.brio.exercices.rediges.RetourExerciceApi.Critere;
import fr.brio.exercices.rediges.RetourExerciceApi.Demande;
import java.time.Clock;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
class RetourIaExercices {
    private static final int ATTENTE_SECONDES = 60;

    private final ExercicesRedigesRepository repository;
    private final RetourExerciceApi provider;
    private final Clock clock;
    private final ThreadPoolTaskExecutor worker;

    RetourIaExercices(ExercicesRedigesRepository repository, RetourExerciceApi provider, Clock clock,
            @Qualifier("retourIaWorker") ThreadPoolTaskExecutor worker) {
        this.repository = repository;
        this.provider = provider;
        this.clock = clock;
        this.worker = worker;
    }

    @Bean(defaultCandidate = false)
    static ThreadPoolTaskExecutor retourIaWorker() {
        var worker = new ThreadPoolTaskExecutor();
        worker.setCorePoolSize(3);
        worker.setMaxPoolSize(3);
        worker.setQueueCapacity(6);
        worker.setThreadNamePrefix("exercices-retour-ia-");
        return worker;
    }

    @TransactionalEventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void planifier(EvaluerCopie event) {
        try {
            worker.execute(() -> evaluer(event));
        } catch (TaskRejectedException exception) {
            conserver(event, RetourIa.indisponible());
        }
    }

    static boolean attenteExpiree(Copie copie, Instant now) {
        return !now.isBefore(copie.remisAt().plusSeconds(ATTENTE_SECONDES));
    }

    private void evaluer(EvaluerCopie event) {
        var definition = repository.trouver(event.exerciceId())
                .filter(e -> e.version() == event.version() && e.modeCorrection() == ExerciceRedige.ModeCorrection.ia);
        var copie = repository.copie(event.exerciceId(), event.eleveId())
                .filter(c -> c.version() == event.version() && !c.photo()
                        && c.retourIa() != null && c.retourIa().etat() == EtatRetourIa.en_attente);
        if (definition.isEmpty() || copie.isEmpty()) {
            return;
        }
        if (!provider.actif() || attenteExpiree(copie.get(), clock.instant())) {
            conserver(event, RetourIa.indisponible());
            return;
        }
        var cle = definition.get().cleCorrection();
        var criteres = cle.criteres().stream().map(c -> new Critere(c.attendu(), c.variantes())).toList();
        var demande = new Demande(copie.get().enonce(), cle.minimum(), criteres, cle.extraitLecon(), copie.get().reponse());
        var retour = provider.evaluer(demande).map(result -> {
            var details = result.verdicts().stream().map(verdict -> new CritereEvalue(
                    criteres.get(verdict.critere() - 1).attendu(), verdict.etat(),
                    verdict.extrait().isEmpty() ? null : verdict.extrait())).toList();
            return new RetourIa(EtatRetourIa.disponible, cle.minimum(), details);
        }).orElseGet(RetourIa::indisponible);
        conserver(event, retour);
    }

    private void conserver(EvaluerCopie event, RetourIa retour) {
        repository.conserverRetourIa(event.exerciceId(), event.version(), event.eleveId(), retour);
    }
}
