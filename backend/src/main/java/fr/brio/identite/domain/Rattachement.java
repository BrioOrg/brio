package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;

/** A teacher's membership of an établissement — several are allowed (ADR 0029 §2). */
@Entity
@Table(schema = "identite", name = "rattachements")
public class Rattachement {

    @EmbeddedId
    private RattachementId id;

    @Column(nullable = false)
    private LocalDate depuis;

    protected Rattachement() {}

    public static Rattachement creer(UUID compteId, UUID etablissementId) {
        var r = new Rattachement();
        r.id = new RattachementId(compteId, etablissementId);
        r.depuis = LocalDate.now();
        return r;
    }

    public RattachementId getId() { return id; }
    public LocalDate getDepuis() { return depuis; }
}
