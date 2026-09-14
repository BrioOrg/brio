package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "inscriptions")
public class Inscription {

    @EmbeddedId
    private InscriptionId id;

    @Column(name = "nom_affiche", nullable = false)
    private String nomAffiche;

    @Column(name = "role_dans_classe", nullable = false)
    private String roleDansClasse = "eleve";

    @Column(nullable = false)
    private LocalDate depuis;

    private LocalDate jusqua;

    protected Inscription() {}

    public static Inscription creer(UUID classeId, UUID compteId, String nomAffiche) {
        var i = new Inscription();
        i.id = new InscriptionId(classeId, compteId);
        i.nomAffiche = nomAffiche;
        i.depuis = LocalDate.now();
        return i;
    }

    public void setNomAffiche(String nomAffiche) {
        this.nomAffiche = nomAffiche;
    }

    public InscriptionId getId() { return id; }
    public String getNomAffiche() { return nomAffiche; }
    public String getRoleDansClasse() { return roleDansClasse; }
    public LocalDate getDepuis() { return depuis; }
    public LocalDate getJusqua() { return jusqua; }
}
