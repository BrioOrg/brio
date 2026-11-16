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

    // Élève accounts only: out-of-class identity, assigned by Brio (#325). Never returned
    // alongside inscriptions.nom_affiche; the student cannot change it.
    private String pseudonyme;

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

    // Teacher-led access reset (ADR 0036): while set, the student must choose their own
    // password before anything else; the provisional one expires and is single-use.
    @Column(name = "doit_changer_mot_de_passe", nullable = false)
    private boolean doitChangerMotDePasse;

    @Column(name = "mot_de_passe_provisoire_expire_le")
    private Instant motDePasseProvisoireExpireLe;

    @Column(name = "mot_de_passe_provisoire_utilise_le")
    private Instant motDePasseProvisoireUtiliseLe;

    protected Compte() {}

    /** Path B (consent): account starts pending, parent must validate email (ADR 0016 §5). */
    public static Compte creerEleve(String identifiantConnexion, String motDePasseHash,
                                    String emailTitulaireLegal, String niveauDeclare,
                                    String pseudonyme) {
        var c = new Compte();
        c.role = RoleCompte.eleve;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.emailTitulaireLegal = emailTitulaireLegal;
        c.baseLegale = BaseLegale.consentement;
        c.niveauDeclare = niveauDeclare;
        c.pseudonyme = pseudonyme;
        return c;
    }

    /**
     * Path A (mission d'intérêt public): account is immediately actif.
     * No parent email collected — the établissement is the controller (ADR 0018 §1).
     */
    public static Compte creerEleveMissionEtablissement(String identifiantConnexion,
                                                         String motDePasseHash,
                                                         UUID etablissementId,
                                                         String pseudonyme) {
        var c = new Compte();
        c.role = RoleCompte.eleve;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.baseLegale = BaseLegale.mission_etablissement;
        c.statut = StatutCompte.actif;
        c.etablissementId = etablissementId;
        c.pseudonyme = pseudonyme;
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
    public String getPseudonyme() { return pseudonyme; }

    public void remplacerPseudonyme(String pseudonyme) {
        this.pseudonyme = pseudonyme;
    }

    public void marquerDernierAcces() {
        this.dernierAccesAt = Instant.now();
    }

    /**
     * Replaces the password with a provisional one (already hashed), valid until {@code expireLe},
     * and requires a password change at the next login (ADR 0036 §2-3). The old password stops
     * working at once.
     */
    public void reinitialiserAcces(String hashProvisoire, Instant expireLe) {
        this.motDePasseHash = hashProvisoire;
        this.doitChangerMotDePasse = true;
        this.motDePasseProvisoireExpireLe = expireLe;
        this.motDePasseProvisoireUtiliseLe = null;
    }

    /** Records the first login with the provisional password, which can then not be reused. */
    public void marquerProvisoireUtilise(Instant maintenant) {
        if (doitChangerMotDePasse && motDePasseProvisoireUtiliseLe == null) {
            this.motDePasseProvisoireUtiliseLe = maintenant;
        }
    }

    /**
     * Whether the provisional password can no longer open a session: expired, or already used
     * once. False for an account with no pending change.
     */
    public boolean provisoireInutilisable(Instant maintenant) {
        return doitChangerMotDePasse
                && (motDePasseProvisoireUtiliseLe != null
                        || !maintenant.isBefore(motDePasseProvisoireExpireLe));
    }

    /** The student's own new password (already hashed) replaces the provisional one. */
    public void changerMotDePasse(String nouveauHash) {
        this.motDePasseHash = nouveauHash;
        this.doitChangerMotDePasse = false;
        this.motDePasseProvisoireExpireLe = null;
        this.motDePasseProvisoireUtiliseLe = null;
    }

    public boolean isDoitChangerMotDePasse() { return doitChangerMotDePasse; }
    public Instant getMotDePasseProvisoireExpireLe() { return motDePasseProvisoireExpireLe; }

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
