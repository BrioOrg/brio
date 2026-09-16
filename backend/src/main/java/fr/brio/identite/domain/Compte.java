package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "comptes")
public class Compte {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoleCompte role;

    @Column(name = "identifiant_connexion", nullable = false, unique = true)
    private String identifiantConnexion;

    @Column(name = "mot_de_passe_hash", nullable = false)
    private String motDePasseHash;

    // Adult roles only (enseignant, admin_etab, admin_brio)
    private String nom;
    private String email;

    // Élève accounts only — never return identifiantConnexion as a display value (ADR 0016 §4)
    @Column(name = "email_titulaire_legal")
    private String emailTitulaireLegal;

    // Legal basis for processing (ADR 0018); required for eleve accounts, null for adults
    @Enumerated(EnumType.STRING)
    @Column(name = "base_legale")
    private BaseLegale baseLegale;

    // Path B only: level the student declared at registration (ADR 0018 §1)
    @Column(name = "niveau_declare")
    private String niveauDeclare;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutCompte statut = StatutCompte.en_attente_consentement;

    @Column(name = "etablissement_id")
    private UUID etablissementId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "dernier_acces_at")
    private Instant dernierAccesAt;

    protected Compte() {}

    /** Path B (consent): account starts pending, parent must validate email (ADR 0016 §5). */
    public static Compte creerEleve(String identifiantConnexion, String motDePasseHash,
                                    String emailTitulaireLegal, String niveauDeclare) {
        var c = new Compte();
        c.role = RoleCompte.eleve;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.emailTitulaireLegal = emailTitulaireLegal;
        c.baseLegale = BaseLegale.consentement;
        c.niveauDeclare = niveauDeclare;
        return c;
    }

    /**
     * Path A (mission d'intérêt public): account is immediately actif.
     * No parent email collected — the établissement is the controller (ADR 0018 §1).
     */
    public static Compte creerEleveMissionEtablissement(String identifiantConnexion,
                                                         String motDePasseHash,
                                                         UUID etablissementId) {
        var c = new Compte();
        c.role = RoleCompte.eleve;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.baseLegale = BaseLegale.mission_etablissement;
        c.statut = StatutCompte.actif;
        c.etablissementId = etablissementId;
        return c;
    }

    public static Compte creerEnseignant(String identifiantConnexion, String motDePasseHash, String nom, String email) {
        var c = new Compte();
        c.role = RoleCompte.enseignant;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.nom = nom;
        c.email = email;
        c.statut = StatutCompte.actif;
        return c;
    }

    public static Compte creerAdminBrio(String identifiantConnexion, String motDePasseHash, String nom, String email) {
        var c = new Compte();
        c.role = RoleCompte.admin_brio;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.nom = nom;
        c.email = email;
        c.statut = StatutCompte.actif;
        return c;
    }

    public UUID getId() { return id; }
    public RoleCompte getRole() { return role; }
    public String getIdentifiantConnexion() { return identifiantConnexion; }
    public String getMotDePasseHash() { return motDePasseHash; }
    public String getNom() { return nom; }
    public String getEmail() { return email; }
    public StatutCompte getStatut() { return statut; }

    public void marquerDernierAcces() {
        this.dernierAccesAt = Instant.now();
    }

    public void activer() {
        this.statut = StatutCompte.actif;
    }

    public void suspendre() {
        this.statut = StatutCompte.suspendu;
    }

    public String getEmailTitulaireLegal() {
        return emailTitulaireLegal;
    }

    public BaseLegale getBaseLegale() {
        return baseLegale;
    }

    public String getNiveauDeclare() {
        return niveauDeclare;
    }
}
