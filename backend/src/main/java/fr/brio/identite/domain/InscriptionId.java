package fr.brio.identite.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record InscriptionId(
        @Column(name = "classe_id") UUID classeId,
        @Column(name = "compte_id") UUID compteId
) implements Serializable {}
