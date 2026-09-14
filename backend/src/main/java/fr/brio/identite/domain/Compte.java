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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutCompte statut = StatutCompte.en_attente_consentement;

    // Nullable until établissements table ships (follow-up ticket)
    @Column(name = "etablissement_id")
    private UUID etablissementId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "dernier_acces_at")
    private Instant dernierAccesAt;

    protected Compte() {}

    public static Compte creerEleve(String identifiantConnexion, String motDePasseHash, String emailTitulaireLegal) {
        var c = new Compte();
        c.role = RoleCompte.eleve;
        c.identifiantConnexion = identifiantConnexion;
        c.motDePasseHash = motDePasseHash;
        c.emailTitulaireLegal = emailTitulaireLegal;
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
}
