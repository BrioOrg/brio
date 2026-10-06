package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Un fil de question d'entraide, attaché à un chapitre (slug) ou un exercice (UUID),
 * visible de la classe de l'auteur (ADR 0023).
 */
@Entity
@Table(name = "fils", schema = "social")
public class Fil {

    public static final String PORTEE_CHAPITRE = "chapitre";
    public static final String PORTEE_EXERCICE = "exercice";

    public static final String STATUT_OUVERT = "ouvert";
    public static final String STATUT_RESOLU = "resolu";
    public static final String STATUT_MASQUE = "masque";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "portee", nullable = false)
    private String portee;

    @Column(name = "portee_ref", nullable = false)
    private String porteeRef;

    @Column(name = "classe_id", nullable = false)
    private UUID classeId;

    @Column(name = "titre", nullable = false)
    private String titre;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(name = "statut", nullable = false)
    private String statut = STATUT_OUVERT;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Fil() {}

    public Fil(String portee, String porteeRef, UUID classeId, String titre, UUID auteurId) {
        this.portee = portee;
        this.porteeRef = porteeRef;
        this.classeId = classeId;
        this.titre = titre;
        this.auteurId = auteurId;
    }

    /** Marque le fil résolu — appelé quand l'auteur retient une réponse utile. */
    public void resoudre() {
        this.statut = STATUT_RESOLU;
    }

    /** Masque le fil (modération). */
    public void masquer() {
        this.statut = STATUT_MASQUE;
    }

    public boolean porteeExercice() {
        return PORTEE_EXERCICE.equals(portee);
    }

    public UUID getId() {
        return id;
    }

    public String getPortee() {
        return portee;
    }

    public String getPorteeRef() {
        return porteeRef;
    }

    public UUID getClasseId() {
        return classeId;
    }

    public String getTitre() {
        return titre;
    }

    public UUID getAuteurId() {
        return auteurId;
    }

    public String getStatut() {
        return statut;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
