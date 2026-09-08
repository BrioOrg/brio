package fr.brio.identite.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
record ConsentementId(UUID compteId, String type) implements Serializable {}
