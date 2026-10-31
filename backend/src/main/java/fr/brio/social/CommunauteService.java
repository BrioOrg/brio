package fr.brio.social;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.api.ProfilEleve;
import fr.brio.identite.api.ProfilsElevesQuery;
import fr.brio.social.api.ReponseUtileValidee;
import fr.brio.social.domain.CorpsCommunaute;
import fr.brio.social.domain.QuestionCommunaute;
import fr.brio.social.domain.ReponseCommunaute;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.VoteCommunauteRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Communauté v1 : questions et réponses entre élèves, sous pseudonyme (ADR 0035). Sans modération
 * ni filtre préventif pendant le développement : c'est le réglage {@code brio.communaute.active}
 * qui verrouille cet espace. Le contrôle du rôle est fait par le contrôleur.
 */
@Service
public class CommunauteService {

    /** Le catalogue ne couvre que les mathématiques (ADR 0035 §7). */
    private static final String MATIERE_PAR_DEFAUT = "mathematiques";
    private static final Set<String> MATIERES = Set.of(MATIERE_PAR_DEFAUT);

    private static final int TITRE_MAX = 200;
    private static final int TAILLE_MAX = 50;
    private static final AuteurCommunaute AUTEUR_INCONNU = new AuteurCommunaute("Membre", null);

    private final QuestionCommunauteRepository questions;
    private final ReponseCommunauteRepository reponses;
    private final VoteCommunauteRepository votes;
    private final ProfilsElevesQuery profils;
    private final ApplicationEventPublisher evenements;
    private final ObjectMapper json;

    CommunauteService(
            QuestionCommunauteRepository questions,
            ReponseCommunauteRepository reponses,
            VoteCommunauteRepository votes,
            ProfilsElevesQuery profils,
            ApplicationEventPublisher evenements,
            ObjectMapper json) {
        this.questions = questions;
        this.reponses = reponses;
        this.votes = votes;
        this.profils = profils;
        this.evenements = evenements;
        this.json = json;
    }

    // ---------------------------------------------------------------- écriture

    @Transactional
    public UUID poserQuestion(UUID auteurId, String titre, JsonNode corps, String matiere) {
        String titreValide = validerTitre(titre);
        String corpsValide = CorpsCommunaute.valider(corps);
        String matiereValide = matiere == null ? MATIERE_PAR_DEFAUT : matiere;
        if (!MATIERES.contains(matiereValide)) {
            throw new MessageInvalideException("Cette matière n'existe pas.");
        }
        ProfilEleve profil = profils.profils(Set.of(auteurId)).get(auteurId);
        String niveau = profil == null ? null : profil.niveau();
        return questions
                .save(new QuestionCommunaute(auteurId, titreValide, corpsValide, niveau, matiereValide))
                .getId();
    }

    @Transactional
    public void modifierQuestion(UUID questionId, UUID demandeurId, String titre, JsonNode corps) {
        QuestionCommunaute question = chargerQuestion(questionId);
        exigerAuteur(question.getAuteurId(), demandeurId);
        question.modifier(validerTitre(titre), CorpsCommunaute.valider(corps), Instant.now());
    }

    @Transactional
    public void supprimerQuestion(UUID questionId, UUID demandeurId) {
        QuestionCommunaute question = chargerQuestion(questionId);
        exigerAuteur(question.getAuteurId(), demandeurId);
        question.supprimer();
    }

    @Transactional
    public UUID repondre(UUID questionId, UUID auteurId, JsonNode corps) {
        chargerQuestion(questionId);
        String valide = CorpsCommunaute.valider(corps);
        return reponses.save(new ReponseCommunaute(questionId, null, auteurId, valide)).getId();
    }

    /** Un seul niveau de commentaires : on commente une réponse, jamais un commentaire. */
    @Transactional
    public UUID commenter(UUID reponseId, UUID auteurId, JsonNode corps) {
        ReponseCommunaute reponse = chargerReponse(reponseId);
        if (reponse.estCommentaire()) {
            throw new MessageInvalideException("On ne peut pas répondre à un commentaire.");
        }
        String valide = CorpsCommunaute.valider(corps);
        return reponses
                .save(new ReponseCommunaute(reponse.getQuestionId(), reponseId, auteurId, valide))
                .getId();
    }

    @Transactional
    public void modifierReponse(UUID reponseId, UUID demandeurId, JsonNode corps) {
        ReponseCommunaute reponse = chargerReponse(reponseId);
        exigerAuteur(reponse.getAuteurId(), demandeurId);
        reponse.modifier(CorpsCommunaute.valider(corps), Instant.now());
    }

    /** Supprimer la réponse qui a résolu la question rouvre celle-ci ; l'XP accordée reste acquise. */
    @Transactional
    public void supprimerReponse(UUID reponseId, UUID demandeurId) {
        ReponseCommunaute reponse = chargerReponse(reponseId);
        exigerAuteur(reponse.getAuteurId(), demandeurId);
        QuestionCommunaute question = questions.verrouiller(reponse.getQuestionId())
                .orElseThrow(MessageCommunauteNotFoundException::new);
        if (reponseId.equals(question.getReponseResolueId())) {
            question.annulerResolution();
        }
        reponse.supprimer();
    }

    @Transactional
    public void voterQuestion(UUID questionId, UUID votantId) {
        QuestionCommunaute question = chargerQuestion(questionId);
        exigerPasAuteur(question.getAuteurId(), votantId);
        votes.voterQuestion(votantId, questionId);
    }

    @Transactional
    public void retirerVoteQuestion(UUID questionId, UUID votantId) {
        chargerQuestion(questionId);
        votes.retirerQuestion(votantId, questionId);
    }

    @Transactional
    public void voterReponse(UUID reponseId, UUID votantId) {
        ReponseCommunaute reponse = chargerReponse(reponseId);
        if (reponse.estCommentaire()) {
            throw new MessageInvalideException("On ne vote pas sur un commentaire.");
        }
        exigerPasAuteur(reponse.getAuteurId(), votantId);
        votes.voterReponse(votantId, reponseId);
    }

    @Transactional
    public void retirerVoteReponse(UUID reponseId, UUID votantId) {
        chargerReponse(reponseId);
        votes.retirerReponse(votantId, reponseId);
    }

    /**
     * L'auteur de la question retient la réponse qui l'a résolue : 15 XP au répondeur via
     * {@link ReponseUtileValidee}. Une seule réponse par question, ce qui borne l'XP qu'un fil peut
     * rapporter ; retenir de nouveau la même ne fait rien.
     */
    @Transactional
    public void resoudre(UUID questionId, UUID reponseId, UUID demandeurId) {
        QuestionCommunaute question = questions.verrouiller(questionId)
                .filter(QuestionCommunaute::estVisible)
                .orElseThrow(MessageCommunauteNotFoundException::new);
        if (!demandeurId.equals(question.getAuteurId())) {
            throw new AccesCommunauteRefuseException("Seul l'auteur de la question peut la marquer comme résolue.");
        }
        ReponseCommunaute reponse = chargerReponse(reponseId);
        if (!reponse.getQuestionId().equals(questionId)) {
            throw new MessageCommunauteNotFoundException();
        }
        if (reponse.estCommentaire()) {
            throw new MessageInvalideException("Un commentaire ne peut pas résoudre une question.");
        }
        if (reponse.getAuteurId().equals(demandeurId)) {
            throw new MessageInvalideException("On ne retient pas sa propre réponse.");
        }
        if (reponseId.equals(question.getReponseResolueId())) {
            return;
        }
        if (question.getReponseResolueId() != null) {
            throw new QuestionDejaResolueException();
        }
        question.resoudre(reponseId);
        evenements.publishEvent(new ReponseUtileValidee(reponse.getAuteurId(), reponseId, Instant.now()));
    }

    // ---------------------------------------------------------------- lecture

    @Transactional(readOnly = true)
    public PageQuestionsCommunaute lister(UUID lecteurId, String niveau, String matiere, int page, int taille) {
        PageRequest demande = PageRequest.of(Math.max(page, 0), Math.clamp(taille, 1, TAILLE_MAX));
        Slice<QuestionCommunaute> trouvees = questions.lister(niveau, matiere, demande);
        List<UUID> ids = trouvees.stream().map(QuestionCommunaute::getId).toList();
        if (ids.isEmpty()) {
            return new PageQuestionsCommunaute(List.of(), false);
        }
        Map<UUID, Long> nombresReponses = enMap(reponses.compter(ids));
        Map<UUID, Long> utiles = enMap(votes.compterQuestions(ids));
        Set<UUID> votees = votes.questionsVotees(lecteurId, ids);
        Map<UUID, AuteurCommunaute> auteurs =
                auteurs(trouvees.stream().map(QuestionCommunaute::getAuteurId).collect(Collectors.toSet()));

        List<QuestionCommunauteResume> resumes = trouvees.stream()
                .map(q -> new QuestionCommunauteResume(
                        q.getId(),
                        q.getTitre(),
                        auteurs.getOrDefault(q.getAuteurId(), AUTEUR_INCONNU),
                        q.getNiveau(),
                        q.getMatiere(),
                        q.getReponseResolueId() != null,
                        nombresReponses.getOrDefault(q.getId(), 0L),
                        utiles.getOrDefault(q.getId(), 0L),
                        votees.contains(q.getId()),
                        q.getAuteurId().equals(lecteurId),
                        q.getEditeAt() != null,
                        q.getCreatedAt()))
                .toList();
        return new PageQuestionsCommunaute(resumes, trouvees.hasNext());
    }

    @Transactional(readOnly = true)
    public QuestionCommunauteDetail consulter(UUID questionId, UUID lecteurId) {
        QuestionCommunaute question = chargerQuestion(questionId);
        List<ReponseCommunaute> messages = reponses.visibles(questionId);
        List<UUID> idsReponses = messages.stream()
                .filter(m -> !m.estCommentaire())
                .map(ReponseCommunaute::getId)
                .toList();
        Map<UUID, Long> utiles = idsReponses.isEmpty() ? Map.of() : enMap(votes.compterReponses(idsReponses));
        Set<UUID> votees = idsReponses.isEmpty() ? Set.of() : votes.reponsesVotees(lecteurId, idsReponses);
        long utilesQuestion = enMap(votes.compterQuestions(List.of(questionId))).getOrDefault(questionId, 0L);
        boolean aVote = !votes.questionsVotees(lecteurId, List.of(questionId)).isEmpty();

        Set<UUID> idsAuteurs = new HashSet<>();
        idsAuteurs.add(question.getAuteurId());
        messages.forEach(m -> idsAuteurs.add(m.getAuteurId()));
        Map<UUID, AuteurCommunaute> auteurs = auteurs(idsAuteurs);

        List<ReponseCommunauteVue> vues = new ArrayList<>();
        for (ReponseCommunaute reponse : messages) {
            if (reponse.estCommentaire()) {
                continue;
            }
            List<CommentaireCommunauteVue> commentaires = messages.stream()
                    .filter(m -> reponse.getId().equals(m.getParentId()))
                    .map(m -> new CommentaireCommunauteVue(
                            m.getId(),
                            lireCorps(m.getCorps()),
                            auteurs.getOrDefault(m.getAuteurId(), AUTEUR_INCONNU),
                            m.getAuteurId().equals(lecteurId),
                            m.getEditeAt() != null,
                            m.getCreatedAt()))
                    .toList();
            vues.add(new ReponseCommunauteVue(
                    reponse.getId(),
                    lireCorps(reponse.getCorps()),
                    auteurs.getOrDefault(reponse.getAuteurId(), AUTEUR_INCONNU),
                    utiles.getOrDefault(reponse.getId(), 0L),
                    votees.contains(reponse.getId()),
                    reponse.getAuteurId().equals(lecteurId),
                    reponse.getId().equals(question.getReponseResolueId()),
                    reponse.getEditeAt() != null,
                    reponse.getCreatedAt(),
                    commentaires));
        }
        return new QuestionCommunauteDetail(
                question.getId(),
                question.getTitre(),
                lireCorps(question.getCorps()),
                auteurs.getOrDefault(question.getAuteurId(), AUTEUR_INCONNU),
                question.getNiveau(),
                question.getMatiere(),
                question.getReponseResolueId() != null,
                utilesQuestion,
                aVote,
                question.getAuteurId().equals(lecteurId),
                question.getEditeAt() != null,
                question.getCreatedAt(),
                vues);
    }

    // ----------------------------------------------------------------- privés

    private QuestionCommunaute chargerQuestion(UUID questionId) {
        return questions.findById(questionId)
                .filter(QuestionCommunaute::estVisible)
                .orElseThrow(MessageCommunauteNotFoundException::new);
    }

    /** Un message n'est accessible que si tout ce qui le porte l'est encore. */
    private ReponseCommunaute chargerReponse(UUID reponseId) {
        ReponseCommunaute reponse = reponses.findById(reponseId)
                .filter(ReponseCommunaute::estVisible)
                .orElseThrow(MessageCommunauteNotFoundException::new);
        chargerQuestion(reponse.getQuestionId());
        if (reponse.estCommentaire()) {
            chargerReponse(reponse.getParentId());
        }
        return reponse;
    }

    private static void exigerAuteur(UUID auteurId, UUID demandeurId) {
        if (!Objects.equals(auteurId, demandeurId)) {
            throw new AccesCommunauteRefuseException("Ce message n'est pas le vôtre.");
        }
    }

    private static void exigerPasAuteur(UUID auteurId, UUID votantId) {
        if (Objects.equals(auteurId, votantId)) {
            throw new AccesCommunauteRefuseException("On ne vote pas pour son propre message.");
        }
    }

    private static String validerTitre(String titre) {
        String net = titre == null ? "" : titre.strip();
        if (net.isEmpty()) {
            throw new MessageInvalideException("Le titre de la question est vide.");
        }
        if (net.length() > TITRE_MAX) {
            throw new MessageInvalideException("Le titre est trop long (max 200 caractères).");
        }
        if (net.indexOf('\0') >= 0) {
            throw new MessageInvalideException("Le titre contient un caractère invalide.");
        }
        return net;
    }

    private Map<UUID, AuteurCommunaute> auteurs(Set<UUID> ids) {
        return profils.profils(ids).entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> new AuteurCommunaute(e.getValue().pseudonyme(), e.getValue().niveau())));
    }

    private static Map<UUID, Long> enMap(Collection<VoteCommunauteRepository.Total> totaux) {
        return totaux.stream()
                .collect(Collectors.toMap(
                        VoteCommunauteRepository.Total::getCible, VoteCommunauteRepository.Total::getTotal));
    }

    private JsonNode lireCorps(String corps) {
        try {
            return json.readTree(corps);
        } catch (JsonProcessingException illisible) {
            throw new IllegalStateException("Corps de message illisible en base", illisible);
        }
    }
}
