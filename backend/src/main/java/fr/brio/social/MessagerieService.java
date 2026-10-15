package fr.brio.social;

import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionInfo;
import fr.brio.identite.api.InscriptionsQuery;
import fr.brio.social.domain.ModerationPreventive;
import fr.brio.social.domain.Salon;
import fr.brio.social.domain.SalonMessage;
import fr.brio.social.domain.SalonSignalement;
import fr.brio.social.domain.Sanction;
import fr.brio.social.infrastructure.SalonMessageRepository;
import fr.brio.social.infrastructure.SalonRepository;
import fr.brio.social.infrastructure.SalonSignalementRepository;
import fr.brio.social.infrastructure.SanctionRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Messagerie de classe (F6b) : un salon de groupe par classe, créé par l'enseignant,
 * visible de toute la classe. Réutilise le socle de modération de F6a — garde préventive
 * ({@link ModerationPreventive}) et sanctions par compte ({@code social.sanctions}),
 * un muet l'est partout (ADR 0033).
 */
@Service
public class MessagerieService {

    private static final Duration FENETRE_ANTI_FLOOD = Duration.ofMinutes(1);
    private static final int MAX_MESSAGES_PAR_FENETRE = 5;
    private static final int EXTRAIT_MAX = 160;
    private static final int TITRE_MAX = 120;
    private static final String NOM_INCONNU = "Membre";

    private final SalonRepository salons;
    private final SalonMessageRepository messages;
    private final SalonSignalementRepository signalements;
    private final SanctionRepository sanctions;
    private final InscriptionsQuery inscriptions;
    private final EnseignantContexteQuery enseignants;

    MessagerieService(
            SalonRepository salons,
            SalonMessageRepository messages,
            SalonSignalementRepository signalements,
            SanctionRepository sanctions,
            InscriptionsQuery inscriptions,
            EnseignantContexteQuery enseignants) {
        this.salons = salons;
        this.messages = messages;
        this.signalements = signalements;
        this.sanctions = sanctions;
        this.inscriptions = inscriptions;
        this.enseignants = enseignants;
    }

    // ---------------------------------------------------------------- écriture

    /** Un enseignant crée un salon pour une de ses classes ; renvoie son identifiant. */
    @Transactional
    public UUID creerSalon(UUID enseignantId, NouveauSalon nouveau) {
        if (!estEnseignant(enseignantId, nouveau.classeId())) {
            throw new AccesMessagerieRefuseException("Vous n'enseignez pas cette classe.");
        }
        String titre = validerTitre(nouveau.titre());
        return salons.save(new Salon(nouveau.classeId(), titre, enseignantId)).getId();
    }

    /** Publie un message dans un salon ; renvoie l'identifiant du message. */
    @Transactional
    public UUID publier(UUID salonId, UUID auteurId, String corps) {
        Salon salon = chargerSalon(salonId);
        exigerMembre(auteurId, salon.getClasseId());
        exigerNonReduitAuSilence(auteurId);
        String texte = ModerationPreventive.valider(corps);
        exigerDebitRaisonnable(auteurId);
        return messages.save(new SalonMessage(salonId, auteurId, texte)).getId();
    }

    /** Signale un message de salon au modérateur de la classe (idempotent par signaleur). */
    @Transactional
    public void signaler(UUID messageId, UUID userId, String motif) {
        SalonMessage message = chargerMessage(messageId);
        Salon salon = chargerSalon(message.getSalonId());
        exigerMembre(userId, salon.getClasseId());
        if (signalements.existsByMessageIdAndSignalePar(messageId, userId)) {
            return;
        }
        signalements.save(new SalonSignalement(messageId, userId, motif));
    }

    // ---------------------------------------------------------------- lecture

    /** Liste les salons des classes du membre (élève ou enseignant). */
    @Transactional(readOnly = true)
    public List<SalonVue> listerSalons(UUID userId) {
        Set<UUID> classes = classesDuMembre(userId);
        if (classes.isEmpty()) {
            return List.of();
        }
        List<SalonVue> vues = new ArrayList<>();
        for (Salon salon : salons.findByClasseIdInOrderByCreatedAtAsc(classes)) {
            long nb = messages.findBySalonIdOrderByCreatedAtAsc(salon.getId()).stream()
                    .filter(SalonMessage::estVisible)
                    .count();
            vues.add(new SalonVue(
                    salon.getId(),
                    salon.getClasseId(),
                    salon.getTitre(),
                    salon.getStatut(),
                    (int) nb,
                    salon.getCreatedAt()));
        }
        return vues;
    }

    /** Messages d'un salon pour un membre ; le prof voit aussi les messages masqués. */
    @Transactional(readOnly = true)
    public List<SalonMessageVue> messagesDuSalon(UUID salonId, UUID userId) {
        Salon salon = chargerSalon(salonId);
        exigerMembre(userId, salon.getClasseId());
        boolean moderateur = estEnseignant(userId, salon.getClasseId());

        List<SalonMessage> tous = messages.findBySalonIdOrderByCreatedAtAsc(salonId);
        Set<UUID> auteurs = new HashSet<>();
        tous.forEach(m -> auteurs.add(m.getAuteurId()));
        Map<UUID, String> noms = resoudreNoms(salon.getClasseId(), auteurs);

        List<SalonMessageVue> vues = new ArrayList<>();
        for (SalonMessage m : tous) {
            if (!moderateur && !m.estVisible()) {
                continue;
            }
            vues.add(new SalonMessageVue(
                    m.getId(),
                    m.getAuteurId(),
                    noms.getOrDefault(m.getAuteurId(), NOM_INCONNU),
                    m.getCorps(),
                    m.getStatut(),
                    m.getAuteurId().equals(userId),
                    m.getCreatedAt()));
        }
        return vues;
    }

    // ------------------------------------------------------------- modération

    /** File des signalements de salon en attente pour les classes de l'enseignant. */
    @Transactional(readOnly = true)
    public List<SalonSignalementVue> fileSignalements(UUID enseignantId) {
        Set<UUID> classes = enseignants.classesEnseignees(enseignantId);
        if (classes.isEmpty()) {
            return List.of();
        }
        List<SalonSignalementVue> vues = new ArrayList<>();
        for (SalonSignalement s :
                signalements.findByStatutOrderByCreatedAtAsc(SalonSignalement.STATUT_OUVERT)) {
            SalonMessage message = messages.findById(s.getMessageId()).orElse(null);
            if (message == null) {
                continue;
            }
            Salon salon = salons.findById(message.getSalonId()).orElse(null);
            if (salon == null || !classes.contains(salon.getClasseId())) {
                continue;
            }
            Map<UUID, String> noms = resoudreNoms(salon.getClasseId(), Set.of(message.getAuteurId()));
            vues.add(new SalonSignalementVue(
                    s.getId(),
                    message.getId(),
                    salon.getId(),
                    salon.getTitre(),
                    message.getAuteurId(),
                    noms.getOrDefault(message.getAuteurId(), NOM_INCONNU),
                    extrait(message.getCorps()),
                    s.getSignalePar(),
                    s.getMotif(),
                    s.getCreatedAt()));
        }
        return vues;
    }

    /** Masque un message de salon et clôt ses signalements (prof de la classe). */
    @Transactional
    public void masquer(UUID enseignantId, UUID messageId) {
        SalonMessage message = chargerMessage(messageId);
        Salon salon = chargerSalon(message.getSalonId());
        if (!estEnseignant(enseignantId, salon.getClasseId())) {
            throw new PasModerateurException("Vous ne modérez pas cette classe.");
        }
        message.masquer();
        Instant maintenant = Instant.now();
        for (SalonSignalement s :
                signalements.findByStatutOrderByCreatedAtAsc(SalonSignalement.STATUT_OUVERT)) {
            if (s.getMessageId().equals(messageId)) {
                s.traiter(enseignantId, maintenant);
            }
        }
    }

    // ----------------------------------------------------------------- privés

    private Salon chargerSalon(UUID salonId) {
        return salons.findById(salonId).orElseThrow(() -> new SalonNotFoundException(salonId));
    }

    private SalonMessage chargerMessage(UUID messageId) {
        return messages.findById(messageId).orElseThrow(() -> new SalonMessageNotFoundException(messageId));
    }

    private boolean estEnseignant(UUID userId, UUID classeId) {
        return enseignants.classesEnseignees(userId).contains(classeId);
    }

    private boolean estEleve(UUID userId, UUID classeId) {
        return inscriptions.classesDeLEleve(userId).contains(classeId);
    }

    private void exigerMembre(UUID userId, UUID classeId) {
        if (!estEleve(userId, classeId) && !estEnseignant(userId, classeId)) {
            throw new AccesMessagerieRefuseException("Vous n'êtes pas membre de cette classe.");
        }
    }

    private Set<UUID> classesDuMembre(UUID userId) {
        Set<UUID> classes = new HashSet<>(inscriptions.classesDeLEleve(userId));
        classes.addAll(enseignants.classesEnseignees(userId));
        return classes;
    }

    private void exigerNonReduitAuSilence(UUID auteurId) {
        Instant maintenant = Instant.now();
        boolean muet = sanctions.findByCompteIdAndType(auteurId, Sanction.TYPE_LECTURE_SEULE).stream()
                .anyMatch(s -> s.interditEcriture(maintenant));
        if (muet) {
            throw new SousSanctionException("Votre accès à la messagerie est en lecture seule.");
        }
    }

    private void exigerDebitRaisonnable(UUID auteurId) {
        Instant depuis = Instant.now().minus(FENETRE_ANTI_FLOOD);
        if (messages.countByAuteurIdAndCreatedAtAfter(auteurId, depuis) >= MAX_MESSAGES_PAR_FENETRE) {
            throw new TropDeMessagesException("Vous écrivez trop vite. Patientez un instant.");
        }
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
            noms.putAll(enseignants.nomsDesEnseignants(manquants));
        }
        return noms;
    }

    private static String validerTitre(String titre) {
        String net = titre == null ? "" : titre.strip();
        if (net.isEmpty()) {
            throw new MessageInvalideException("Le titre du salon est vide.");
        }
        if (net.length() > TITRE_MAX) {
            throw new MessageInvalideException("Le titre est trop long (max " + TITRE_MAX + " caractères).");
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
