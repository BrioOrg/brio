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
    private final PasswordEncoder passwordEncoder;
    private final IdentifiantGenerator identifiantGenerator;

    public ClasseService(EtablissementRepository etablissements,
                         ClasseRepository classes,
                         CodeClasseRepository codesClasses,
                         InscriptionRepository inscriptions,
                         CompteRepository comptes,
                         PasswordEncoder passwordEncoder,
                         IdentifiantGenerator identifiantGenerator) {
        this.etablissements = etablissements;
        this.classes = classes;
        this.codesClasses = codesClasses;
        this.inscriptions = inscriptions;
        this.comptes = comptes;
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
                                   String libelle, String anneeScolaire) {
        etablissements.findById(etablissementId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Établissement introuvable"));
        Classe classe = classes.save(Classe.creer(etablissementId, niveauCode, libelle, anneeScolaire));
        return toClasseInfo(classe);
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

    private static EtablissementInfo toEtabInfo(Etablissement e) {
        return new EtablissementInfo(e.getId(), e.getNom(), e.getUai(), e.getType(),
                e.getConventionSigneeLe(), e.getConventionReference(), e.peutUtiliserPathA());
    }

    private static ClasseInfo toClasseInfo(Classe c) {
        return new ClasseInfo(c.getId(), c.getEtablissementId(), c.getNiveauCode(),
                c.getLibelle(), c.getAnneeScolaire(), c.getStatut().name());
    }

    static List<InscriptionInfo> withHomonymeFlag(List<Inscription> inscriptions) {
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
