package fr.brio.identite;

import fr.brio.identite.api.ReinitialisationAccesInfo;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.Inscription;
import fr.brio.identite.domain.InscriptionId;
import fr.brio.identite.domain.ReinitialisationAcces;
import fr.brio.identite.domain.RoleCompte;
import fr.brio.identite.domain.StatutClasse;
import fr.brio.identite.domain.StatutCompte;
import fr.brio.identite.infrastructure.ClasseRepository;
import fr.brio.identite.infrastructure.CompteRepository;
import fr.brio.identite.infrastructure.InscriptionRepository;
import fr.brio.identite.infrastructure.ReinitialisationAccesRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Teacher-led recovery of a student's access to their EXISTING account (ADR 0036): the adult
 * gets, once, the student's login identifier and a provisional password valid 7 days and usable
 * once; the student then chooses their own password before anything else. The account, its
 * classes and its progression are untouched.
 */
@Service
public class ReinitialisationAccesService {

    /** How long a provisional password opens a session (≤ 7 days, ADR 0036 §3). */
    static final Duration VALIDITE = Duration.ofDays(7);

    private final ClasseRepository classes;
    private final InscriptionRepository inscriptions;
    private final CompteRepository comptes;
    private final ReinitialisationAccesRepository traces;
    private final PasswordEncoder passwordEncoder;
    private final ProtectionConnexionService protection;
    private final FindByIndexNameSessionRepository<?> sessions;
    private final int maxParHeureParAdulte;
    private final int maxParJourParEleve;

    ReinitialisationAccesService(ClasseRepository classes,
                                 InscriptionRepository inscriptions,
                                 CompteRepository comptes,
                                 ReinitialisationAccesRepository traces,
                                 PasswordEncoder passwordEncoder,
                                 ProtectionConnexionService protection,
                                 FindByIndexNameSessionRepository<?> sessions,
                                 @Value("${brio.reinitialisation.max-par-heure-par-adulte:40}") int maxParHeureParAdulte,
                                 @Value("${brio.reinitialisation.max-par-jour-par-eleve:5}") int maxParJourParEleve) {
        this.classes = classes;
        this.inscriptions = inscriptions;
        this.comptes = comptes;
        this.traces = traces;
        this.passwordEncoder = passwordEncoder;
        this.protection = protection;
        this.sessions = sessions;
        this.maxParHeureParAdulte = maxParHeureParAdulte;
        this.maxParJourParEleve = maxParJourParEleve;
    }

    /**
     * Resets the access of a student enrolled in the given class (ADR 0036 §1).
     *
     * @throws ResponseStatusException 404 unknown class, or student not enrolled in it
     * @throws ResponseStatusException 403 caller is neither the class's teacher nor ADMIN_BRIO,
     *                                 or the class is archived
     * @throws ResponseStatusException 409 the student's account is not active
     * @throws ResponseStatusException 429 too many resets (per adult per hour, per student per day)
     */
    @Transactional
    public ReinitialisationAccesInfo reinitialiser(UUID classeId, UUID eleveId,
                                                   UUID demandePar, boolean isAdminBrio) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable"));
        if (!isAdminBrio && !demandePar.equals(classe.getEnseignantPrincipalId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (classe.getStatut() != StatutClasse.active) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cette classe est archivée");
        }

        Inscription inscription = inscriptions.findById(new InscriptionId(classeId, eleveId))
                .filter(i -> "eleve".equals(i.getRoleDansClasse()))
                .filter(i -> i.getJusqua() == null || !i.getJusqua().isBefore(LocalDate.now()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Élève non inscrit dans cette classe"));
        Compte eleve = comptes.findById(inscription.getId().compteId())
                .filter(c -> c.getRole() == RoleCompte.eleve)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Élève non inscrit dans cette classe"));
        if (eleve.getStatut() != StatutCompte.actif) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Le compte de cet élève n'est pas actif : une réinitialisation ne lui rendrait pas l'accès.");
        }

        Instant maintenant = Instant.now();
        if (traces.countByParCompteIdAndCreeLeAfter(demandePar, maintenant.minus(Duration.ofHours(1)))
                        >= maxParHeureParAdulte
                || traces.countByCompteIdAndCreeLeAfter(eleveId, maintenant.minus(Duration.ofDays(1)))
                        >= maxParJourParEleve) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Trop de réinitialisations en peu de temps. Réessayez plus tard.");
        }

        String provisoire = MotDePasseProvisoire.generer();
        Instant expireLe = maintenant.plus(VALIDITE);
        eleve.reinitialiserAcces(passwordEncoder.encode(provisoire), expireLe);
        comptes.save(eleve);
        traces.save(ReinitialisationAcces.tracer(eleveId, demandePar, classeId, maintenant, expireLe));

        // The teacher has just seen the student: clear a lockout so the first try works (§6, AC8).
        protection.reinitialiser(eleve.getIdentifiantConnexion());
        // Close every open session of the account: one held by someone else must neither survive
        // nor be the one that chooses the new password (§6).
        sessions.findByPrincipalName(eleveId.toString()).keySet().forEach(sessions::deleteById);

        return new ReinitialisationAccesInfo(eleve.getIdentifiantConnexion(), provisoire, expireLe);
    }

    /**
     * The connected student chooses their own password after a reset (ADR 0036 §5). Accepted only
     * while a change is pending: without the current password, it must not become a free change
     * a stolen session could use.
     *
     * @throws ResponseStatusException 409 no change pending
     * @throws ResponseStatusException 422 the new password is the provisional one
     */
    @Transactional
    public void changerMotDePasse(UUID compteId, String nouveauMotDePasse) {
        Compte compte = comptes.findById(compteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Compte introuvable"));
        if (!compte.isDoitChangerMotDePasse()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Aucun changement de mot de passe n'est demandé pour ce compte.");
        }
        if (passwordEncoder.matches(nouveauMotDePasse, compte.getMotDePasseHash())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Choisis un mot de passe différent du mot de passe provisoire.");
        }
        compte.changerMotDePasse(passwordEncoder.encode(nouveauMotDePasse));
        comptes.save(compte);
    }
}
