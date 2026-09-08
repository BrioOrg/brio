package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(schema = "identite", name = "consentements")
class Consentement {

    @EmbeddedId
    ConsentementId id;

    @Column(name = "donne_par_email", nullable = false)
    String donneParEmail;

    @Column(name = "donne_at", nullable = false)
    Instant donneAt;

    @Column(nullable = false)
    String preuve;

    @Column(name = "revoque_at")
    Instant revoqueAt;

    protected Consentement() {}
}
