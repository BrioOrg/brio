package fr.brio.social;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.api.ProfilEleve;
import fr.brio.identite.api.ProfilsElevesQuery;
import fr.brio.social.api.ReponseUtileRevoquee;
import fr.brio.social.domain.CibleCommunaute;
import fr.brio.social.domain.ContestationModeration;
import fr.brio.social.domain.CorpsCommunaute;
import fr.brio.social.domain.DecisionModeration;
import fr.brio.social.domain.QuestionCommunaute;
import fr.brio.social.domain.ReponseCommunaute;
import fr.brio.social.domain.SignalementCommunaute;
import fr.brio.social.infrastructure.ContestationModerationRepository;
import fr.brio.social.infrastructure.DecisionModerationRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SignalementCommunauteRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Console de modération de la Communauté (suivi #338, ADR 0035). Côté membre : signaler un contenu,
 * contester une décision. Côté {@code admin_brio} : la file des signalements, les décisions
 * (masquer / supprimer / rejeter / restaurer), la révocation de l'XP « réponse utile », et les
 * contestations à trancher avec intervention humaine. Le contrôle du rôle est fait par les
 * contrôleurs ({@code admin_brio} via SecurityConfig, membre via la Communauté).
 */
@Service
public class ModerationCommunauteService {

    private static final int MOTIF_MAX = 1_000;
    private static final int CONTESTATION_MAX = 2_000;
    private static final int EXTRAIT_MAX = 280;
    private static final String PSEUDO_INCONNU = "Membre";
    private static final Set<String> ACTIONS_CONTESTABLES =
            Set.of(DecisionModeration.ACTION_MASQUER, DecisionModeration.ACTION_SUPPRIMER);

    private final SignalementCommunauteRepository signalements;
    private final DecisionModerationRepository decisions;
    private final ContestationModerationRepository contestations;
    private final QuestionCommunauteRepository questions;
    private final ReponseCommunauteRepository reponses;
    private final ProfilsElevesQuery profils;
    private final ApplicationEventPublisher evenements;
    private final ObjectMapper json;

    ModerationCommunauteService(
            SignalementCommunauteRepository signalements,
            DecisionModerationRepository decisions,
            ContestationModerationRepository contestations,
            QuestionCommunauteRepository questions,
            ReponseCommunauteRepository reponses,
            ProfilsElevesQuery profils,
            ApplicationEventPublisher evenements,
            ObjectMapper json) {
        this.signalements = signalements;
        this.decisions = decisions;
        this.contestations = contestations;
        this.questions = questions;
        this.reponses = reponses;
        this.profils = profils;
        this.evenements = evenements;
        this.json = json;
    }

    // ----------------------------------------------------------------- membre

    /** Un membre signale une question ou une réponse visible. Idempotent par (cible, signaleur). */
    @Transactional
    public void signaler(CibleCommunaute cible, UUID cibleId, UUID signalePar, String motif) {
        Contenu contenu = chargerContenu(cible, cibleId);
        if (!contenu.visible()) {
            throw new MessageCommunauteNotFoundException();
        }
        if (signalements.existsByCibleTypeAndCibleIdAndSignalePar(cible.code(), cibleId, signalePar)) {
            return; // déjà signalé par ce membre — idempotent
        }
        signalements.save(new SignalementCommunaute(cible, cibleId, signalePar, netMotif(motif)));
    }

    /**
     * L'auteur d'un contenu masqué ou supprimé conteste la décision. Une seule contestation par
     * décision ; seul l'auteur du contenu peut contester.
     */
    @Transactional
    public UUID contester(CibleCommunaute cible, UUID cibleId, UUID demandeurId, String message) {
        Contenu contenu = chargerContenu(cible, cibleId);
        if (!demandeurId.equals(contenu.auteurId())) {
            throw new AccesCommunauteRefuseException("Seul l'auteur du contenu peut contester une décision.");
        }
        DecisionModeration decision = decisions
                .findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(
                        cible.code(), cibleId, ACTIONS_CONTESTABLES)
                .orElseThrow(() ->
                        new MessageInvalideException("Aucune décision de modération à contester sur ce contenu."));
        if (contestations.existsByDecisionId(decision.getId())) {
            throw new MessageInvalideException("Cette décision a déjà été contestée.");
        }
        String net = message == null ? "" : message.strip();
        if (net.isEmpty()) {
            throw new MessageInvalideException("Le message de contestation est vide.");
        }
        if (net.length() > CONTESTATION_MAX) {
            throw new MessageInvalideException("Le message de contestation est trop long.");
        }
        return contestations
                .save(new ContestationModeration(decision.getId(), cible, cibleId, demandeurId, net))
                .getId();
    }

    // ------------------------------------------------------------- admin_brio

    /** La file des signalements ouverts, agrégés par cible, les plus anciens d'abord. */
    @Transactional(readOnly = true)
    public List<SignalementCommunauteVue> fileSignalements() {
        List<SignalementCommunaute> ouverts =
                signalements.findByStatutOrderByCreatedAtAsc(SignalementCommunaute.STATUT_OUVERT);
        // Regroupe par cible en gardant l'ordre d'apparition (le plus ancien signalement d'abord).
        Map<String, List<SignalementCommunaute>> parCible = new LinkedHashMap<>();
        for (SignalementCommunaute s : ouverts) {
            parCible.computeIfAbsent(s.getCible().code() + '|' + s.getCibleId(), c -> new ArrayList<>()).add(s);
        }
        List<SignalementCommunauteVue> vues = new ArrayList<>();
        for (List<SignalementCommunaute> groupe : parCible.values()) {
            SignalementCommunaute premier = groupe.get(0);
            CibleCommunaute cible = premier.getCible();
            Contenu contenu = chargerContenuOuNull(cible, premier.getCibleId());
            if (contenu == null) {
                continue; // la cible a disparu entre-temps (cascade) — plus rien à modérer
            }
            List<String> motifs = groupe.stream()
                    .map(SignalementCommunaute::getMotif)
                    .filter(m -> m != null && !m.isBlank())
                    .toList();
            boolean xpRevoquee = cible == CibleCommunaute.REPONSE
                    && decisions.existsByCibleTypeAndCibleIdAndAction(
                            cible.code(), premier.getCibleId(), DecisionModeration.ACTION_REVOQUER_XP);
            vues.add(new SignalementCommunauteVue(
                    cible.code(),
                    premier.getCibleId(),
                    contenu.questionId(),
                    pseudonyme(contenu.auteurId()),
                    contenu.extrait(),
                    contenu.statut(),
                    contenu.estReponseResolue(),
                    xpRevoquee,
                    groupe.size(),
                    motifs,
                    premier.getCreatedAt()));
        }
        return vues;
    }

    /**
     * Une décision de modération sur une cible. {@code masquer}/{@code supprimer}/{@code restaurer}
     * changent la visibilité du contenu, {@code rejeter} le laisse en ligne, {@code revoquer_xp}
     * retire l'XP « réponse utile » (réponses uniquement). Clôt les signalements ouverts de la cible.
     */
    @Transactional
    public UUID decider(CibleCommunaute cible, UUID cibleId, UUID parAdmin, String action, String motif) {
        Contenu contenu = chargerContenu(cible, cibleId);
        switch (action) {
            case DecisionModeration.ACTION_MASQUER -> contenu.masquer();
            case DecisionModeration.ACTION_SUPPRIMER -> contenu.supprimer();
            case DecisionModeration.ACTION_RESTAURER -> contenu.restaurer();
            case DecisionModeration.ACTION_REJETER -> {
                /* le contenu reste en ligne ; on ne clôt que les signalements */
            }
            case DecisionModeration.ACTION_REVOQUER_XP -> revoquerXp(cible, contenu, cibleId);
            default -> throw new MessageInvalideException("Action de modération inconnue.");
        }
        UUID decisionId = decisions
                .save(new DecisionModeration(cible, cibleId, action, netMotif(motif), parAdmin))
                .getId();
        cloreSignalements(cible, cibleId, parAdmin);
        return decisionId;
    }

    /** Les contestations ouvertes, les plus anciennes d'abord. */
    @Transactional(readOnly = true)
    public List<ContestationModerationVue> fileContestations() {
        List<ContestationModerationVue> vues = new ArrayList<>();
        for (ContestationModeration c :
                contestations.findByStatutOrderByCreatedAtAsc(ContestationModeration.STATUT_OUVERTE)) {
            DecisionModeration decision = decisions.findById(c.getDecisionId()).orElse(null);
            Contenu contenu = chargerContenuOuNull(c.getCible(), c.getCibleId());
            vues.add(new ContestationModerationVue(
                    c.getId(),
                    c.getCible().code(),
                    c.getCibleId(),
                    contenu == null ? c.getCibleId() : contenu.questionId(),
                    pseudonyme(c.getAuteurId()),
                    contenu == null ? "" : contenu.extrait(),
                    c.getMessage(),
                    decision == null ? null : decision.getAction(),
                    decision == null ? null : decision.getMotif(),
                    contenu == null ? null : contenu.statut(),
                    c.getCreatedAt()));
        }
        return vues;
    }

    /**
     * Tranche une contestation avec intervention humaine. {@code accepter} true restaure le contenu
     * masqué (une suppression efface le corps : elle n'est pas restaurable, on rouvre seulement le
     * statut) et enregistre une décision {@code restaurer} ; false laisse la décision en place.
     */
    @Transactional
    public void trancherContestation(UUID contestationId, UUID parAdmin, boolean accepter, String reponse) {
        ContestationModeration contestation = contestations
                .findById(contestationId)
                .orElseThrow(MessageCommunauteNotFoundException::new);
        if (!contestation.estOuverte()) {
            throw new MessageInvalideException("Cette contestation a déjà été tranchée.");
        }
        Instant maintenant = Instant.now();
        if (accepter) {
            Contenu contenu = chargerContenu(contestation.getCible(), contestation.getCibleId());
            contenu.restaurer();
            decisions.save(new DecisionModeration(
                    contestation.getCible(),
                    contestation.getCibleId(),
                    DecisionModeration.ACTION_RESTAURER,
                    netMotif(reponse),
                    parAdmin));
        }
        contestation.trancher(accepter, netMotif(reponse), parAdmin, maintenant);
    }

    // ----------------------------------------------------------------- privés

    private void revoquerXp(CibleCommunaute cible, Contenu contenu, UUID cibleId) {
        if (cible != CibleCommunaute.REPONSE) {
            throw new MessageInvalideException("L'XP « réponse utile » ne concerne que les réponses.");
        }
        evenements.publishEvent(new ReponseUtileRevoquee(contenu.auteurId(), cibleId, Instant.now()));
    }

    private void cloreSignalements(CibleCommunaute cible, UUID cibleId, UUID parAdmin) {
        Instant maintenant = Instant.now();
        for (SignalementCommunaute s : signalements.findByCibleTypeAndCibleIdAndStatut(
                cible.code(), cibleId, SignalementCommunaute.STATUT_OUVERT)) {
            s.traiter(parAdmin, maintenant);
        }
    }

    private String pseudonyme(UUID compteId) {
        ProfilEleve profil = profils.profils(Set.of(compteId)).get(compteId);
        return profil == null ? PSEUDO_INCONNU : profil.pseudonyme();
    }

    private Contenu chargerContenu(CibleCommunaute cible, UUID cibleId) {
        Contenu contenu = chargerContenuOuNull(cible, cibleId);
        if (contenu == null) {
            throw new MessageCommunauteNotFoundException();
        }
        return contenu;
    }

    private Contenu chargerContenuOuNull(CibleCommunaute cible, UUID cibleId) {
        if (cible == CibleCommunaute.QUESTION) {
            return questions.findById(cibleId).map(QuestionContenu::new).orElse(null);
        }
        Optional<ReponseCommunaute> reponse = reponses.findById(cibleId);
        if (reponse.isEmpty()) {
            return null;
        }
        UUID resolueId = questions.findById(reponse.get().getQuestionId())
                .map(QuestionCommunaute::getReponseResolueId)
                .orElse(null);
        boolean resolue = resolueId != null && resolueId.equals(reponse.get().getId());
        return new ReponseContenu(reponse.get(), resolue);
    }

    private static String netMotif(String motif) {
        if (motif == null) {
            return null;
        }
        String net = motif.strip();
        if (net.isEmpty()) {
            return null;
        }
        return net.length() > MOTIF_MAX ? net.substring(0, MOTIF_MAX) : net;
    }

    private String extraitCorps(String corps) {
        try {
            return CorpsCommunaute.extrait(json.readTree(corps), EXTRAIT_MAX);
        } catch (JsonProcessingException illisible) {
            return "";
        }
    }

    /** Vue uniforme sur une question ou une réponse, pour agir sans dupliquer les deux branches. */
    private interface Contenu {
        UUID auteurId();

        String statut();

        boolean visible();

        String extrait();

        UUID questionId();

        boolean estReponseResolue();

        void masquer();

        void supprimer();

        void restaurer();
    }

    private final class QuestionContenu implements Contenu {
        private final QuestionCommunaute q;

        QuestionContenu(QuestionCommunaute q) {
            this.q = q;
        }

        @Override
        public UUID auteurId() {
            return q.getAuteurId();
        }

        @Override
        public String statut() {
            return q.getStatut();
        }

        @Override
        public boolean visible() {
            return q.estVisible();
        }

        @Override
        public String extrait() {
            return q.getTitre() == null ? "" : q.getTitre();
        }

        @Override
        public UUID questionId() {
            return q.getId();
        }

        @Override
        public boolean estReponseResolue() {
            return false;
        }

        @Override
        public void masquer() {
            q.masquer();
        }

        @Override
        public void supprimer() {
            q.supprimer();
        }

        @Override
        public void restaurer() {
            q.restaurer();
        }
    }

    private final class ReponseContenu implements Contenu {
        private final ReponseCommunaute r;
        private final boolean resolue;

        ReponseContenu(ReponseCommunaute r, boolean resolue) {
            this.r = r;
            this.resolue = resolue;
        }

        @Override
        public UUID auteurId() {
            return r.getAuteurId();
        }

        @Override
        public String statut() {
            return r.getStatut();
        }

        @Override
        public boolean visible() {
            return r.estVisible();
        }

        @Override
        public String extrait() {
            return extraitCorps(r.getCorps());
        }

        @Override
        public UUID questionId() {
            return r.getQuestionId();
        }

        @Override
        public boolean estReponseResolue() {
            return resolue;
        }

        @Override
        public void masquer() {
            r.masquer();
        }

        @Override
        public void supprimer() {
            r.supprimer();
        }

        @Override
        public void restaurer() {
            r.restaurer();
        }
    }
}
