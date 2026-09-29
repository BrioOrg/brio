package fr.brio.devoirs.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Un devoir assigné par un enseignant à une classe (ADR 0020). Il pointe vers un cours ou un
 * chapitre et une liste ordonnée d'exercices ; les autres modules sont référencés par UUID. En v1
 * seul le type {@code devoir_maison} existe, et la correction se dévoile à l'échéance.
 */
@Entity
@Table(name = "devoirs", schema = "devoirs")
public class Devoir {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "classe_id", nullable = false)
    private UUID classeId;

    @Column(name = "auteur_id", nullable = false)
    private UUID auteurId;

    @Column(nullable = false)
    private String titre;

    @Column private String consigne;

    @Column(nullable = false)
    private String type;

    @Column(name = "source_type", nullable = false)
    private String sourceType;

    @Column(name = "source_ref", nullable = false)
    private String sourceRef;

    @Column(name = "source_version")
    private Integer sourceVersion;

    @ElementCollection
    @CollectionTable(
            name = "devoir_exercices",
            schema = "devoirs",
            joinColumns = @JoinColumn(name = "devoir_id"))
    @OrderColumn(name = "ordre")
    @Column(name = "exercice_id", nullable = false)
    private List<UUID> exerciceIds = new ArrayList<>();

    @Column(name = "ouvre_at", nullable = false)
    private Instant ouvreAt;

    @Column(name = "echeance_at", nullable = false)
    private Instant echeanceAt;

    @Column(name = "correction_visible_at", nullable = false)
    private Instant correctionVisibleAt;

    @Column(nullable = false)
    private String statut;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Devoir() {}

    public Devoir(
            UUID classeId,
            UUID auteurId,
            String titre,
            String consigne,
            String type,
            String sourceType,
            String sourceRef,
            Integer sourceVersion,
            List<UUID> exerciceIds,
            Instant ouvreAt,
            Instant echeanceAt) {
        this.classeId = classeId;
        this.auteurId = auteurId;
        this.titre = titre;
        this.consigne = consigne;
        this.type = normaliserType(type);
        this.sourceType = sourceType;
        this.sourceRef = sourceRef;
        this.sourceVersion = sourceVersion;
        this.exerciceIds = new ArrayList<>(exerciceIds);
        this.ouvreAt = ouvreAt;
        this.echeanceAt = echeanceAt;
        this.correctionVisibleAt = echeanceAt; // v1 : la correction se dévoile à l'échéance
        this.statut = "publie";
        this.createdAt = Instant.now();
    }

    public static final String DEVOIR_MAISON = "devoir_maison";
    public static final String CONTROLE = "controle";

    /** Type par défaut {@code devoir_maison} ; seul {@code controle} est l'autre valeur reconnue. */
    private static String normaliserType(String type) {
        return CONTROLE.equals(type) ? CONTROLE : DEVOIR_MAISON;
    }

    public int nombreExercices() {
        return exerciceIds.size();
    }

    public UUID getId() {
        return id;
    }

    public UUID getClasseId() {
        return classeId;
    }

    public UUID getAuteurId() {
        return auteurId;
    }

    public String getTitre() {
        return titre;
    }

    public String getConsigne() {
        return consigne;
    }

    public String getType() {
        return type;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getSourceRef() {
        return sourceRef;
    }

    public Integer getSourceVersion() {
        return sourceVersion;
    }

    public List<UUID> getExerciceIds() {
        return List.copyOf(exerciceIds);
    }

    public Instant getOuvreAt() {
        return ouvreAt;
    }

    public Instant getEcheanceAt() {
        return echeanceAt;
    }

    public Instant getCorrectionVisibleAt() {
        return correctionVisibleAt;
    }

    public String getStatut() {
        return statut;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
