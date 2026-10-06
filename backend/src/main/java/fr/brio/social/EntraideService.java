package fr.brio.social;

import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionInfo;
import fr.brio.identite.api.InscriptionsQuery;
import fr.brio.social.api.ReponseUtileValidee;
import fr.brio.social.domain.Fil;
import fr.brio.social.domain.Message;
import fr.brio.social.domain.ModerationPreventive;
import fr.brio.social.domain.Sanction;
import fr.brio.social.domain.Signalement;
import fr.brio.social.infrastructure.FilRepository;
import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.SanctionRepository;
import fr.brio.social.infrastructure.SignalementRepository;
import fr.brio.social.infrastructure.SoumissionVueRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Entraide (F6a) : fils de question attachés à un chapitre ou un exercice, visibles de
 * la classe. Applique la garde anti-triche et le socle de modération (ADR 0023).
 *
 * <p>Les contrôles d'appartenance (élève/enseignant d'une classe) passent par les ports
 * {@code identite.api} ; les références aux autres modules sont des identifiants.
 */
@Service
public class EntraideService {

    /** Fenêtre et plafond de la limitation de débit préventive à l'écriture. */
    private static final Duration FENETRE_ANTI_FLOOD = Duration.ofMinutes(1);
    private static final int MAX_MESSAGES_PAR_FENETRE = 5;

    /** Longueur de l'extrait de message montré dans la file de modération. */
    private static final int EXTRAIT_MAX = 160;

    private static final String NOM_INCONNU = "Membre";

    private final FilRepository fils;
    private final MessageRepository messages;
    private final SignalementRepository signalements;
    private final SanctionRepository sanctions;
    private final SoumissionVueRepository soumissionsVues;
    private final InscriptionsQuery inscriptions;
    private final EnseignantContexteQuery enseignants;
    private final ApplicationEventPublisher evenements;

    EntraideService(
            FilRepository fils,
            MessageRepository messages,
            SignalementRepository signalements,
            SanctionRepository sanctions,
            SoumissionVueRepository soumissionsVues,
            InscriptionsQuery inscriptions,
            EnseignantContexteQuery enseignants,
            ApplicationEventPublisher evenements) {
        this.fils = fils;
        this.messages = messages;
        this.signalements = signalements;
        this.sanctions = sanctions;
        this.soumissionsVues = soumissionsVues;
        this.inscriptions = inscriptions;
        this.enseignants = enseignants;
        this.evenements = evenements;
    }

    // ---------------------------------------------------------------- écriture

    /** Ouvre un fil (une question) ; renvoie son identifiant. */
    @Transactional
    public UUID ouvrirFil(UUID auteurId, NouveauFil nouveau) {
        String portee = validerPortee(nouveau.portee());
        String porteeRef = validerPorteeRef(portee, nouveau.porteeRef());
        String titre = validerTitre(nouveau.titre());
        UUID classeId = nouveau.classeId();
        exigerMembre(auteurId, classeId);
        exigerNonReduitAuSilence(auteurId);
        String question = ModerationPreventive.valider(nouveau.question());
        exigerDebitRaisonnable(auteurId);

        Fil fil = fils.save(new Fil(portee, porteeRef, classeId, titre, auteurId));
        messages.save(new Message(fil.getId(), auteurId, question));
        return fil.getId();
    }

    /** Répond dans un fil ; renvoie l'identifiant du message créé. */
    @Transactional
    public UUID repondre(UUID filId, UUID auteurId, String corps) {
        Fil fil = chargerFil(filId);
        exigerMembre(auteurId, fil.getClasseId());
        exigerNonReduitAuSilence(auteurId);
        String texte = ModerationPreventive.valider(corps);
        exigerDebitRaisonnable(auteurId);
        return messages.save(new Message(filId, auteurId, texte)).getId();
    }

    /** L'auteur du fil retient une réponse comme utile → 15 XP au répondeur (F2). */
    @Transactional
    public void marquerUtile(UUID filId, UUID messageId, UUID demandeurId) {
        Fil fil = chargerFil(filId);
        if (!demandeurId.equals(fil.getAuteurId())) {
            throw new AccesEntraideRefuseException("Seul l'auteur du fil peut retenir une réponse utile.");
        }
        Message message = chargerMessage(messageId);
        if (!message.getFilId().equals(filId)) {
            throw new MessageNotFoundException(messageId);
        }
        if (message.getAuteurId().equals(fil.getAuteurId())) {
            throw new MessageInvalideException("On ne retient pas sa propre réponse.");
        }
        if (message.estUtile()) {
            return; // déjà retenue — idempotent, pas de double XP
        }
        Instant maintenant = Instant.now();
        message.marquerUtile(fil.getAuteurId(), maintenant);
        fil.resoudre();
        evenements.publishEvent(new ReponseUtileValidee(message.getAuteurId(), message.getId(), maintenant));
    }

    /** Signale un message au modérateur de la classe (idempotent par signaleur). */
    @Transactional
    public void signaler(UUID messageId, UUID userId, String motif) {
        Message message = chargerMessage(messageId);
        Fil fil = chargerFil(message.getFilId());
        exigerMembre(userId, fil.getClasseId());
        if (signalements.existsByMessageIdAndSignalePar(messageId, userId)) {
            return;
        }
        signalements.save(new Signalement(messageId, userId, motif));
    }

    // ---------------------------------------------------------------- lecture

    /** Liste les fils d'un chapitre ou d'un exercice pour un membre de la classe. */
    @Transactional(readOnly = true)
    public List<FilVue> listerFils(UUID userId, String portee, String porteeRef, UUID classeId) {
        exigerMembre(userId, classeId);
        boolean moderateur = estEnseignant(userId, classeId);
        List<Fil> trouves =
                fils.findByClasseIdAndPorteeAndPorteeRefOrderByCreatedAtDesc(classeId, portee, porteeRef);

        Set<UUID> auteurs = new HashSet<>();
        trouves.forEach(f -> auteurs.add(f.getAuteurId()));
        Map<UUID, String> noms = resoudreNoms(classeId, auteurs);

        List<FilVue> vues = new ArrayList<>();
        for (Fil fil : trouves) {
            if (Fil.STATUT_MASQUE.equals(fil.getStatut()) && !moderateur) {
                continue;
            }
            long publies = messages.countByFilIdAndStatut(fil.getId(), Message.STATUT_PUBLIE);
            int reponses = (int) Math.max(0, publies - 1); // le 1er message est la question
            vues.add(new FilVue(
                    fil.getId(),
                    fil.getPortee(),
                    fil.getPorteeRef(),
                    fil.getTitre(),
                    fil.getAuteurId(),
                    noms.getOrDefault(fil.getAuteurId(), NOM_INCONNU),
                    fil.getStatut(),
                    Fil.STATUT_RESOLU.equals(fil.getStatut()),
                    reponses,
                    fil.getCreatedAt()));
        }
        return vues;
    }

    /** Détaille un fil et ses messages pour un lecteur, garde anti-triche appliquée. */
    @Transactional(readOnly = true)
    public FilDetail consulterFil(UUID filId, UUID userId) {
        Fil fil = chargerFil(filId);
        exigerMembre(userId, fil.getClasseId());
        boolean estAuteur = userId.equals(fil.getAuteurId());
        boolean moderateur = estEnseignant(userId, fil.getClasseId());

        boolean verrouille = fil.porteeExercice()
                && !estAuteur
                && !moderateur
                && !aSoumisExercice(userId, fil.getPorteeRef());

        List<Message> tous = messages.findByFilIdOrderByCreatedAtAsc(filId);

        Set<UUID> auteurs = new HashSet<>();
        auteurs.add(fil.getAuteurId());
        tous.forEach(m -> auteurs.add(m.getAuteurId()));
        Map<UUID, String> noms = resoudreNoms(fil.getClasseId(), auteurs);

        List<MessageVue> visibles = new ArrayList<>();
        int masquees = 0;
        for (Message m : tous) {
            boolean lisible = moderateur || Message.STATUT_PUBLIE.equals(m.getStatut());
            if (!lisible) {
                continue;
            }
            if (verrouille && !m.getAuteurId().equals(userId)) {
                masquees++;
                continue;
            }
            visibles.add(new MessageVue(
                    m.getId(),
                    m.getAuteurId(),
                    noms.getOrDefault(m.getAuteurId(), NOM_INCONNU),
                    m.getCorps(),
                    m.getStatut(),
                    m.estUtile(),
                    m.getAuteurId().equals(userId),
                    m.getCreatedAt()));
        }

        return new FilDetail(
                fil.getId(),
                fil.getPortee(),
                fil.getPorteeRef(),
                fil.getTitre(),
                fil.getAuteurId(),
                noms.getOrDefault(fil.getAuteurId(), NOM_INCONNU),
                fil.getStatut(),
                estAuteur,
                verrouille,
                masquees,
                visibles,
                fil.getCreatedAt());
    }

    // ------------------------------------------------------------- modération

    /** File des signalements en attente pour les classes que l'enseignant modère. */
    @Transactional(readOnly = true)
    public List<SignalementVue> fileSignalements(UUID enseignantId) {
        Set<UUID> classes = enseignants.classesEnseignees(enseignantId);
        if (classes.isEmpty()) {
            return List.of();
        }
        List<SignalementVue> vues = new ArrayList<>();
        for (Signalement s : signalements.findByStatutOrderByCreatedAtAsc(Signalement.STATUT_OUVERT)) {
            Message message = messages.findById(s.getMessageId()).orElse(null);
            if (message == null) {
                continue;
            }
            Fil fil = fils.findById(message.getFilId()).orElse(null);
            if (fil == null || !classes.contains(fil.getClasseId())) {
                continue;
            }
            Map<UUID, String> noms = resoudreNoms(fil.getClasseId(), Set.of(message.getAuteurId()));
            vues.add(new SignalementVue(
                    s.getId(),
                    message.getId(),
                    fil.getId(),
                    fil.getTitre(),
                    message.getAuteurId(),
                    noms.getOrDefault(message.getAuteurId(), NOM_INCONNU),
                    extrait(message.getCorps()),
                    s.getSignalePar(),
                    s.getMotif(),
                    s.getCreatedAt()));
        }
        return vues;
    }

    /** Masque un message et clôt ses signalements (prof modérateur de la classe). */
    @Transactional
    public void masquerMessage(UUID enseignantId, UUID messageId) {
        Message message = chargerMessage(messageId);
        Fil fil = chargerFil(message.getFilId());
        exigerModerateur(enseignantId, fil.getClasseId());
        message.masquer();
        Instant maintenant = Instant.now();
        for (Signalement s : signalements.findByStatutOrderByCreatedAtAsc(Signalement.STATUT_OUVERT)) {
            if (s.getMessageId().equals(messageId)) {
                s.traiter(enseignantId, maintenant);
            }
        }
    }

    /** Applique une sanction à un élève de la classe (prof modérateur de la classe). */
    @Transactional
    public UUID sanctionner(
            UUID enseignantId, UUID compteId, UUID classeId, String type, String motif, Instant fin) {
        exigerModerateur(enseignantId, classeId);
        if (!inscriptions.classesDeLEleve(compteId).contains(classeId)) {
            throw new AccesEntraideRefuseException("Ce compte n'est pas un élève de cette classe.");
        }
        if (!Sanction.TYPE_AVERTISSEMENT.equals(type) && !Sanction.TYPE_LECTURE_SEULE.equals(type)) {
            throw new MessageInvalideException("Type de sanction inconnu : " + type);
        }
        return sanctions.save(new Sanction(compteId, type, motif, enseignantId, fin)).getId();
    }

    // ----------------------------------------------------------------- privés

    private Fil chargerFil(UUID filId) {
        return fils.findById(filId).orElseThrow(() -> new FilNotFoundException(filId));
    }

    private Message chargerMessage(UUID messageId) {
        return messages.findById(messageId).orElseThrow(() -> new MessageNotFoundException(messageId));
    }

    private boolean estEleve(UUID userId, UUID classeId) {
        return inscriptions.classesDeLEleve(userId).contains(classeId);
    }

    private boolean estEnseignant(UUID userId, UUID classeId) {
        return enseignants.classesEnseignees(userId).contains(classeId);
    }

    private void exigerMembre(UUID userId, UUID classeId) {
        if (!estEleve(userId, classeId) && !estEnseignant(userId, classeId)) {
            throw new AccesEntraideRefuseException("Vous n'êtes pas membre de cette classe.");
        }
    }

    private void exigerModerateur(UUID enseignantId, UUID classeId) {
        if (!estEnseignant(enseignantId, classeId)) {
            throw new PasModerateurException("Vous ne modérez pas cette classe.");
        }
    }

    private void exigerNonReduitAuSilence(UUID auteurId) {
        Instant maintenant = Instant.now();
        boolean muet = sanctions.findByCompteIdAndType(auteurId, Sanction.TYPE_LECTURE_SEULE).stream()
                .anyMatch(s -> s.interditEcriture(maintenant));
        if (muet) {
            throw new SousSanctionException("Votre accès à l'entraide est en lecture seule.");
        }
    }

    private void exigerDebitRaisonnable(UUID auteurId) {
        Instant depuis = Instant.now().minus(FENETRE_ANTI_FLOOD);
        if (messages.countByAuteurIdAndCreatedAtAfter(auteurId, depuis) >= MAX_MESSAGES_PAR_FENETRE) {
            throw new TropDeMessagesException("Vous écrivez trop vite. Patientez un instant.");
        }
    }

    private boolean aSoumisExercice(UUID eleveId, String porteeRef) {
        UUID exerciceId;
        try {
            exerciceId = UUID.fromString(porteeRef);
        } catch (IllegalArgumentException referenceNonUuid) {
            return false; // une portée exercice mal formée reste verrouillée par sûreté
        }
        return soumissionsVues.existsByEleveIdAndExerciceId(eleveId, exerciceId);
    }

    private Map<UUID, String> resoudreNoms(UUID classeId, Set<UUID> ids) {
        Map<UUID, String> noms = new HashMap<>();
        for (InscriptionInfo eleve : inscriptions.elevesDeLaClasse(classeId)) {
            noms.put(eleve.compteId(), eleve.nomAffiche());
        }
        Set<UUID> manquants = new HashSet<>();
        for (UUID id : ids) {
            if (!noms.containsKey(id)) {
                manquants.add(id);
            }
        }
        if (!manquants.isEmpty()) {
            noms.putAll(enseignants.nomsDesEnseignants(manquants)); // les profs ne sont pas des inscrits
        }
        return noms;
    }

    private static String validerPortee(String portee) {
        if (Fil.PORTEE_CHAPITRE.equals(portee) || Fil.PORTEE_EXERCICE.equals(portee)) {
            return portee;
        }
        throw new MessageInvalideException("Portée inconnue : " + portee);
    }

    private static String validerPorteeRef(String portee, String porteeRef) {
        String ref = porteeRef == null ? "" : porteeRef.strip();
        if (ref.isEmpty()) {
            throw new MessageInvalideException("La cible du fil est manquante.");
        }
        if (Fil.PORTEE_EXERCICE.equals(portee)) {
            try {
                UUID.fromString(ref);
            } catch (IllegalArgumentException pasUnUuid) {
                throw new MessageInvalideException("La référence d'exercice doit être un identifiant valide.");
            }
        }
        return ref;
    }

    private static String validerTitre(String titre) {
        String net = titre == null ? "" : titre.strip();
        if (net.isEmpty()) {
            throw new MessageInvalideException("Le titre de la question est vide.");
        }
        if (net.length() > 200) {
            throw new MessageInvalideException("Le titre est trop long (max 200 caractères).");
        }
        return net;
    }

    private static String extrait(String corps) {
        if (corps.length() <= EXTRAIT_MAX) {
            return corps;
        }
        return corps.substring(0, EXTRAIT_MAX) + "…";
    }
}
