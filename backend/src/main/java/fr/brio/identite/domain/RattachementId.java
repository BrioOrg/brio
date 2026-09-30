package fr.brio.identite.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record RattachementId(
        @Column(name = "compte_id") UUID compteId,
        @Column(name = "etablissement_id") UUID etablissementId
) implements Serializable {}
