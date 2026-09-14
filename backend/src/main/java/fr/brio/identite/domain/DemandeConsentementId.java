package fr.brio.identite.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.UUID;

@Embeddable
public record DemandeConsentementId(UUID compteId, String type) implements Serializable {}
