package fr.brio.contenu.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Métadonnées d'une annale (F7, ADR 0026). Le sujet lui-même est ingéré comme un chapitre
 * (contenu.chapitres) ; cette entité ne porte que les métadonnées d'examen, reliées au chapitre
 * par son id (= slug). Upsert par {@code save()} (clé assignée) lors de l'ingestion.
 */
@Entity
@Table(name = "annales", schema = "contenu")
public class Annale {

    @Id
    @Column(name = "chapitre_id", nullable = false)
    private String chapitreId;

    @Column(nullable = false)
    private String examen;

    @Column(nullable = false)
    private String session;

    @Column(nullable = false)
    private int annee;

    @Column
    private String centre;

    @Column(name = "matiere_code", nullable = false)
    private String matiereCode;

    @Column(name = "niveau_code", nullable = false)
    private String niveauCode;

    @Column(name = "duree_minutes")
    private Integer dureeMinutes;

    @Column
    private String licence;

    @Column(name = "source_url")
    private String sourceUrl;

    protected Annale() {}

    public Annale(String chapitreId, String examen, String session, int annee, String centre,
                  String matiereCode, String niveauCode, Integer dureeMinutes, String licence,
                  String sourceUrl) {
        this.chapitreId = chapitreId;
        this.examen = examen;
        this.session = session;
        this.annee = annee;
        this.centre = centre;
        this.matiereCode = matiereCode;
        this.niveauCode = niveauCode;
        this.dureeMinutes = dureeMinutes;
        this.licence = licence;
        this.sourceUrl = sourceUrl;
    }

    public String getChapitreId() { return chapitreId; }
    public String getExamen() { return examen; }
    public String getSession() { return session; }
    public int getAnnee() { return annee; }
    public String getCentre() { return centre; }
    public String getMatiereCode() { return matiereCode; }
    public String getNiveauCode() { return niveauCode; }
    public Integer getDureeMinutes() { return dureeMinutes; }
    public String getLicence() { return licence; }
    public String getSourceUrl() { return sourceUrl; }
}
