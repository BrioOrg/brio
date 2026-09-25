package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "classes")
public class Classe {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "etablissement_id", nullable = false)
    private UUID etablissementId;

    @Column(name = "niveau_code", nullable = false)
    private String niveauCode;

    @Column(nullable = false)
    private String libelle;

    @Column(name = "annee_scolaire", nullable = false)
    private String anneeScolaire;

    // Nullable: a class may exist between teachers before one is assigned (ADR 0016 §1)
    @Column(name = "enseignant_principal_id")
    private UUID enseignantPrincipalId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatutClasse statut = StatutClasse.active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Classe() {}

    public static Classe creer(UUID etablissementId, String niveauCode,
                                String libelle, String anneeScolaire) {
        return creer(etablissementId, niveauCode, libelle, anneeScolaire, null);
    }

    public static Classe creer(UUID etablissementId, String niveauCode,
                                String libelle, String anneeScolaire,
                                UUID enseignantPrincipalId) {
        var c = new Classe();
        c.etablissementId = etablissementId;
        c.niveauCode = niveauCode;
        c.libelle = libelle;
        c.anneeScolaire = anneeScolaire;
        c.enseignantPrincipalId = enseignantPrincipalId;
        return c;
    }

    /** Sets (or replaces) the principal teacher — the account that owns and authors for the class. */
    public void assignerEnseignantPrincipal(UUID enseignantPrincipalId) {
        this.enseignantPrincipalId = enseignantPrincipalId;
    }

    public UUID getId() { return id; }
    public UUID getEtablissementId() { return etablissementId; }
    public String getNiveauCode() { return niveauCode; }
    public String getLibelle() { return libelle; }
    public String getAnneeScolaire() { return anneeScolaire; }
    public UUID getEnseignantPrincipalId() { return enseignantPrincipalId; }
    public StatutClasse getStatut() { return statut; }
}
