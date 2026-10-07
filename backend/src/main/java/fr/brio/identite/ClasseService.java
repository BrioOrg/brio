package fr.brio.identite;

import fr.brio.identite.api.*;
import fr.brio.identite.domain.*;
import fr.brio.identite.infrastructure.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ClasseService {

    // Code alphabet: alphanumeric minus 0/O/1/I — legible off a whiteboard (ADR 0018 §6)
    private static final String CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    private static final int DEFAULT_TTL_JOURS  = 14;
    private static final int MAX_TTL_JOURS      = 60;
    private static final int DEFAULT_USAGES_MAX = 40;

    private final EtablissementRepository etablissements;
    private final ClasseRepository classes;
    private final CodeClasseRepository codesClasses;
    private final InscriptionRepository inscriptions;
    private final CompteRepository comptes;
    private final RattachementRepository rattachements;
    private final PasswordEncoder passwordEncoder;
    private final IdentifiantGenerator identifiantGenerator;

    public ClasseService(EtablissementRepository etablissements,
                         ClasseRepository classes,
                         CodeClasseRepository codesClasses,
                         InscriptionRepository inscriptions,
                         CompteRepository comptes,
                         RattachementRepository rattachements,
                         PasswordEncoder passwordEncoder,
                         IdentifiantGenerator identifiantGenerator) {
        this.etablissements = etablissements;
        this.classes = classes;
        this.codesClasses = codesClasses;
        this.inscriptions = inscriptions;
        this.comptes = comptes;
        this.rattachements = rattachements;
        this.passwordEncoder = passwordEncoder;
        this.identifiantGenerator = identifiantGenerator;
    }

    @Transactional
    public EtablissementInfo creerEtablissement(String nom, String uai, String type,
                                                 LocalDate conventionSigneeLe,
                                                 String conventionReference) {
        Etablissement etab = etablissements.save(
                Etablissement.creer(nom, uai, type, conventionSigneeLe, conventionReference));
        return toEtabInfo(etab);
    }

    @Transactional
    public ClasseInfo creerClasse(UUID etablissementId, String niveauCode,
                                   String libelle, String anneeScolaire,
                                   UUID enseignantPrincipalId) {
        etablissements.findById(etablissementId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Établissement introuvable"));
        if (enseignantPrincipalId != null) {
            verifierEstEnseignant(enseignantPrincipalId);
            assurerRattachement(enseignantPrincipalId, etablissementId);
        }
        Classe classe = classes.save(
                Classe.creer(etablissementId, niveauCode, libelle, anneeScolaire, enseignantPrincipalId));
        return toClasseInfo(classe);
    }

    /**
     * Assigns (or replaces) the class's principal teacher — the account that owns and authors for
     * the class, and from which its établissement is derived ({@link EnseignantContexteQuery}).
     *
     * @throws ResponseStatusException 404 if the class or the account is unknown
     * @throws ResponseStatusException 422 if the account is not an enseignant
     */
    @Transactional
    public ClasseInfo assignerEnseignantPrincipal(UUID classeId, UUID enseignantId) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));
        verifierEstEnseignant(enseignantId);
        assurerRattachement(enseignantId, classe.getEtablissementId());
        classe.assignerEnseignantPrincipal(enseignantId);
        return toClasseInfo(classes.save(classe));
    }

    /** Every établissement, as the public pick-list of the teacher signup (ADR 0029 §1). */
    @Transactional(readOnly = true)
    public List<EtablissementPublicInfo> listerEtablissements() {
        return toPublicInfos(etablissements.findAll());
    }

    /** The établissements the given teacher is attached to. Never {@code null}. */
    @Transactional(readOnly = true)
    public List<EtablissementPublicInfo> etablissementsDeLEnseignant(UUID enseignantId) {
        List<UUID> ids = rattachements.findByIdCompteId(enseignantId).stream()
                .map(r -> r.getId().etablissementId())
                .toList();
        return toPublicInfos(etablissements.findAllById(ids));
    }

    /**
     * Attaches the teacher to one more établissement — a replacement teacher serves several
     * (ADR 0029 §2). Attaching twice is a no-op.
     *
     * @throws ResponseStatusException 404 if the établissement is unknown
     */
    @Transactional
    public EtablissementPublicInfo rattacher(UUID enseignantId, UUID etablissementId) {
        Etablissement etab = etablissements.findById(etablissementId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Établissement introuvable"));
        assurerRattachement(enseignantId, etablissementId);
        return toPublicInfo(etab);
    }

    /**
     * A teacher creates their own class, in one of their établissements, and becomes its
     * principal teacher. The school year is the current one (ADR 0029 §3).
     *
     * @throws ResponseStatusException 403 if the teacher is not attached to the établissement
     */
    @Transactional
    public ClasseInfo creerClassePourEnseignant(UUID enseignantId, UUID etablissementId,
                                                 String niveauCode, String libelle) {
        if (!rattachements.existsById(new RattachementId(enseignantId, etablissementId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Vous n'êtes pas rattaché à cet établissement");
        }
        Classe classe = classes.save(Classe.creer(etablissementId, niveauCode.trim(),
                libelle.trim(), AnneeScolaire.du(LocalDate.now()), enseignantId));
        return toClasseInfo(classe);
    }

    /**
     * A teacher generates the code of a class they are the principal of, with the default
     * lifetime and usage cap (ADR 0029 §3, amending ADR 0018 §6).
     *
     * @throws ResponseStatusException 404 if the class is unknown
     * @throws ResponseStatusException 403 if the caller is not its principal teacher
     */
    @Transactional
    public CodeClasseCreee genererCodePourEnseignant(UUID classeId, UUID enseignantId) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));
        if (!enseignantId.equals(classe.getEnseignantPrincipalId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return genererCode(classeId, enseignantId, DEFAULT_TTL_JOURS, DEFAULT_USAGES_MAX);
    }

    // A principal teacher always belongs to the class's établissement.
    private void assurerRattachement(UUID enseignantId, UUID etablissementId) {
        var id = new RattachementId(enseignantId, etablissementId);
        if (!rattachements.existsById(id)) {
            rattachements.save(Rattachement.creer(enseignantId, etablissementId));
        }
    }

    private void verifierEstEnseignant(UUID compteId) {
        Compte compte = comptes.findById(compteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Enseignant introuvable"));
        if (compte.getRole() != RoleCompte.enseignant) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Le compte désigné n'est pas un enseignant");
        }
    }

    /**
     * Generates a new class code for the given class.
     * Any previous code for the class is invalidated first (one active code per class).
     */
    @Transactional
    public CodeClasseCreee genererCode(UUID classeId, UUID creePar,
                                        int expireDansJours, int usagesMax) {
        classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));

        int ttl = Math.min(expireDansJours, MAX_TTL_JOURS);
        Instant expireAt = Instant.now().plus(ttl, ChronoUnit.DAYS);

        codesClasses.findByClasseId(classeId).ifPresent(codesClasses::delete);

        String rawCode = generateCode();
        String hash = sha256Hex(rawCode);
        CodeClasse code = codesClasses.save(
                CodeClasse.creer(hash, classeId, creePar, expireAt, usagesMax));

        return new CodeClasseCreee(code.getId(), rawCode, expireAt, 0, usagesMax);
    }

    /**
     * Returns code metadata for the class.
     * Access: ADMIN_BRIO always; ENSEIGNANT only when they are enseignant_principal of the class.
     */
    @Transactional(readOnly = true)
    public CodeClasseInfo getCodeInfo(UUID classeId, UUID demandePar, boolean isAdminBrio) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));

        if (!isAdminBrio && !demandePar.equals(classe.getEnseignantPrincipalId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        CodeClasse code = codesClasses.findByClasseId(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucun code actif pour cette classe"));

        return new CodeClasseInfo(code.getId(), code.getExpireAt(),
                code.getUsages(), code.getUsagesMax());
    }

    /**
     * Revokes the active code for the class.
     * Access: ADMIN_BRIO always; ENSEIGNANT only when they are enseignant_principal of the class.
     */
    @Transactional
    public void revoquerCode(UUID classeId, UUID demandePar, boolean isAdminBrio) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));

        if (!isAdminBrio && !demandePar.equals(classe.getEnseignantPrincipalId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        CodeClasse code = codesClasses.findByClasseId(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Aucun code actif pour cette classe"));

        codesClasses.delete(code);
    }

    /**
     * Path A student enrollment (ADR 0018 §1).
     * Validates the class code, checks the convention gate, and creates an
     * immediately-active élève account + inscription in one transaction.
     *
     * @throws ResponseStatusException 404 if code unknown
     * @throws ResponseStatusException 410 if code expired or exhausted
     * @throws ResponseStatusException 403 if établissement has no signed convention
     */
    @Transactional
    public EleveInscritInfo rejoindreParCode(String rawCode, String motDePasse, String nomAffiche) {
        String normalized = rawCode.replaceAll("[\\s\\-]", "").toUpperCase();
        String hash = sha256Hex(normalized);

        CodeClasse code = codesClasses.findByCodeHash(hash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Code de classe invalide"));

        if (code.estExpire()) {
            throw new ResponseStatusException(HttpStatus.GONE, "Ce code a expiré");
        }
        if (code.estEpuise()) {
            throw new ResponseStatusException(HttpStatus.GONE,
                    "Ce code a atteint son nombre maximum d'utilisations");
        }

        Classe classe = classes.findById(code.getClasseId())
                .orElseThrow(() -> new IllegalStateException(
                        "Classe introuvable pour code valide: " + code.getClasseId()));

        Etablissement etab = etablissements.findById(classe.getEtablissementId())
                .orElseThrow(() -> new IllegalStateException(
                        "Établissement introuvable pour classe: " + classe.getId()));

        if (!etab.peutUtiliserPathA()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "L'établissement n'a pas encore signé sa convention — inscription non autorisée");
        }

        String identifiant = identifiantGenerator.generateUnique();
        String hash2 = passwordEncoder.encode(motDePasse);

        Compte compte = comptes.save(
                Compte.creerEleveMissionEtablissement(identifiant, hash2, etab.getId()));

        inscriptions.save(Inscription.creer(classe.getId(), compte.getId(), nomAffiche));

        code.enregistrerUsage();
        codesClasses.save(code);

        return new EleveInscritInfo(compte.getId(), identifiant, nomAffiche, classe.getLibelle());
    }

    /**
     * Returns the élève roster for a class, with a homonyme flag on any nom_affiche
     * that is shared by more than one student. Teacher-only access (or ADMIN_BRIO).
     */
    @Transactional(readOnly = true)
    public List<InscriptionInfo> listerInscrits(UUID classeId, UUID demandePar, boolean isAdminBrio) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));

        if (!isAdminBrio && !demandePar.equals(classe.getEnseignantPrincipalId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        List<Inscription> eleves = inscriptions.findByIdClasseId(classeId).stream()
                .filter(i -> "eleve".equals(i.getRoleDansClasse()))
                .toList();

        return withHomonymeFlag(eleves);
    }

    /**
     * Lets the class teacher rename a student's nom_affiche (ADR 0016 §3).
     * Returns the updated inscription with an up-to-date homonyme flag.
     */
    @Transactional
    public InscriptionInfo renommerEleve(UUID classeId, UUID compteId,
                                          String nouveauNom, UUID demandePar, boolean isAdminBrio) {
        Classe classe = classes.findById(classeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Classe introuvable"));

        if (!isAdminBrio && !demandePar.equals(classe.getEnseignantPrincipalId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        Inscription inscription = inscriptions.findById(new InscriptionId(classeId, compteId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Élève non inscrit dans cette classe"));

        inscription.setNomAffiche(nouveauNom);
        inscriptions.save(inscription);

        List<Inscription> eleves = inscriptions.findByIdClasseId(classeId).stream()
                .filter(i -> "eleve".equals(i.getRoleDansClasse()))
                .toList();

        return withHomonymeFlag(eleves).stream()
                .filter(i -> i.compteId().equals(compteId))
                .findFirst()
                .orElseThrow();
    }

    // --- private helpers ---

    private static String generateCode() {
        var rng = new SecureRandom();
        var sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(CODE_ALPHABET.charAt(rng.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    static String sha256Hex(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static List<EtablissementPublicInfo> toPublicInfos(List<Etablissement> etabs) {
        return etabs.stream()
                .sorted(Comparator.comparing(Etablissement::getNom, String.CASE_INSENSITIVE_ORDER))
                .map(ClasseService::toPublicInfo)
                .toList();
    }

    private static EtablissementPublicInfo toPublicInfo(Etablissement e) {
        return new EtablissementPublicInfo(e.getId(), e.getNom(), e.getType());
    }

    private static EtablissementInfo toEtabInfo(Etablissement e) {
        return new EtablissementInfo(e.getId(), e.getNom(), e.getUai(), e.getType(),
                e.getConventionSigneeLe(), e.getConventionReference(), e.peutUtiliserPathA());
    }

    /**
     * The active classes the given teacher is the principal of, as labelled infos — the set a
     * teacher may scope a course to (ADR 0019 §4). Mirrors {@code EnseignantContexteQuery} but
     * returns labels for the publish screen's class picker, not bare IDs.
     */
    @Transactional(readOnly = true)
    public List<ClasseInfo> classesDeLEnseignant(UUID enseignantId) {
        return classes.findByEnseignantPrincipalId(enseignantId).stream()
                .filter(c -> c.getStatut() == StatutClasse.active)
                .map(ClasseService::toClasseInfo)
                .toList();
    }

    /**
     * The active classes the given student is enrolled in, by label — how the web learns which
     * class an entraide thread belongs to (ADR 0023). Empty for an account with no class.
     */
    @Transactional(readOnly = true)
    public List<ClasseInfo> classesDeLEleve(UUID eleveId) {
        List<UUID> ids = inscriptions.findByIdCompteId(eleveId).stream()
                .filter(i -> "eleve".equals(i.getRoleDansClasse()))
                .map(i -> i.getId().classeId())
                .toList();
        return classes.findAllById(ids).stream()
                .filter(c -> c.getStatut() == StatutClasse.active)
                .sorted(Comparator.comparing(Classe::getLibelle))
                .map(ClasseService::toClasseInfo)
                .toList();
    }

    private static ClasseInfo toClasseInfo(Classe c) {
        return new ClasseInfo(c.getId(), c.getEtablissementId(), c.getNiveauCode(),
                c.getLibelle(), c.getAnneeScolaire(), c.getStatut().name(),
                c.getEnseignantPrincipalId());
    }

    public static List<InscriptionInfo> withHomonymeFlag(List<Inscription> inscriptions) {
        Map<String, Long> countByNom = inscriptions.stream()
                .collect(Collectors.groupingBy(Inscription::getNomAffiche, Collectors.counting()));
        return inscriptions.stream()
                .map(i -> new InscriptionInfo(
                        i.getId().compteId(),
                        i.getNomAffiche(),
                        i.getDepuis(),
                        countByNom.get(i.getNomAffiche()) > 1))
                .toList();
    }
}
