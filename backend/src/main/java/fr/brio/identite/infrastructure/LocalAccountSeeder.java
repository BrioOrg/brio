package fr.brio.identite.infrastructure;

import fr.brio.identite.ClasseService;
import fr.brio.identite.api.EtablissementInfo;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.Inscription;
import java.time.LocalDate;
import java.util.UUID;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds a fixed set of already-active dev accounts on startup so features that require
 * authentication can be tested without going through the signup/consent flows by hand.
 *
 * <p>Local profile only — never runs against a real environment, so it can never create
 * these well-known credentials in production. Idempotent: skips any account whose
 * identifiant already exists, so restarts and re-runs are safe.
 *
 * <p>Developers log in through the real {@code POST /api/sessions} flow (web login form or
 * curl) with these credentials; this exercises the actual auth/role/status code rather than
 * bypassing security. The password is a local fixture, not a secret.
 */
@Component
@Profile("local")
@Order(1)
class LocalAccountSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalAccountSeeder.class);

    /** Shared password for every seeded dev account. Local fixture, not a secret. */
    private static final String DEV_PASSWORD = "password";

    private final CompteRepository comptes;
    private final ClasseRepository classes;
    private final InscriptionRepository inscriptions;
    private final ClasseService classeService;
    private final PasswordEncoder passwordEncoder;

    LocalAccountSeeder(CompteRepository comptes, ClasseRepository classes,
                       InscriptionRepository inscriptions,
                       ClasseService classeService, PasswordEncoder passwordEncoder) {
        this.comptes = comptes;
        this.classes = classes;
        this.inscriptions = inscriptions;
        this.classeService = classeService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        String hash = passwordEncoder.encode(DEV_PASSWORD);

        seed("prof.demo", () -> Compte.creerEnseignant("prof.demo", hash, "Prof Démo", "prof.demo@brio.local"));
        seed("admin.demo", () -> Compte.creerAdminBrio("admin.demo", hash, "Admin Démo", "admin.demo@brio.local"));
        seed("eleve.demo", () -> creerEleveActif(hash));

        seedClasseDemo();
        seedEleveClasse(hash);
    }

    /**
     * Gives prof.demo a class they are the enseignant_principal of, so they immediately have a
     * non-empty établissement (derived from their classes) and can create/publish a course.
     * Idempotent: skips when prof.demo already runs a class.
     */
    private void seedClasseDemo() {
        UUID profId = comptes.findByIdentifiantConnexion("prof.demo")
                .map(Compte::getId)
                .orElse(null);
        if (profId == null || !classes.findByEnseignantPrincipalId(profId).isEmpty()) {
            return;
        }
        EtablissementInfo etab = classeService.creerEtablissement(
                "Collège Démo", null, "college", LocalDate.now().minusYears(1), "CONV-DEMO");
        classeService.creerClasse(etab.id(), "3e", "3e Démo", "2026-2027", profId);
        log.info("Seeded demo class '3e Démo' for prof.demo — local profile");
    }

    /**
     * A student enrolled in prof.demo's class, created exactly as the real class-code flow
     * does ({@link ClasseService#rejoindreParCode}): a path A account attached to the class's
     * établissement, plus an inscription. It is the account that can read a course prof.demo
     * publishes to '3e Démo' (course access is scoped by class). eleve.demo stays the path B,
     * class-less student. Idempotent: skips when eleve.classe already exists.
     */
    private void seedEleveClasse(String hash) {
        if (comptes.findByIdentifiantConnexion("eleve.classe").isPresent()) {
            log.debug("Dev account 'eleve.classe' already present — skipping");
            return;
        }
        Classe classe = comptes.findByIdentifiantConnexion("prof.demo")
                .map(prof -> classes.findByEnseignantPrincipalId(prof.getId()))
                .flatMap(list -> list.stream().findFirst())
                .orElse(null);
        if (classe == null) {
            return;
        }
        Compte eleve = comptes.save(Compte.creerEleveMissionEtablissement(
                "eleve.classe", hash, classe.getEtablissementId()));
        inscriptions.save(Inscription.creer(classe.getId(), eleve.getId(), "Élève Classe"));
        log.info("Seeded dev account 'eleve.classe' (password '{}') in '{}' — local profile",
                DEV_PASSWORD, classe.getLibelle());
    }

    /** Path B élève, activated directly — dev fixture bypasses the parental consent step. */
    private Compte creerEleveActif(String hash) {
        var eleve = Compte.creerEleve("eleve.demo", hash, "parent.demo@brio.local", "3e");
        eleve.activer();
        return eleve;
    }

    private void seed(String identifiant, Supplier<Compte> factory) {
        if (comptes.findByIdentifiantConnexion(identifiant).isPresent()) {
            log.debug("Dev account '{}' already present — skipping", identifiant);
            return;
        }
        comptes.save(factory.get());
        log.info("Seeded dev account '{}' (password '{}') — local profile", identifiant, DEV_PASSWORD);
    }
}
