package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "demandes_consentement")
public class DemandeConsentement {

    static final Duration TOKEN_TTL = Duration.ofDays(7);

    @EmbeddedId
    private DemandeConsentementId id;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expire_at", nullable = false)
    private Instant expireAt;

    @Column(name = "envoye_a", nullable = false)
    private String envoyeA;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected DemandeConsentement() {}

    public static DemandeConsentement creer(UUID compteId, String type, String tokenHash, String envoyeA) {
        var d = new DemandeConsentement();
        d.id = new DemandeConsentementId(compteId, type);
        d.tokenHash = tokenHash;
        d.envoyeA = envoyeA;
        d.expireAt = Instant.now().plus(TOKEN_TTL);
        return d;
    }

    public DemandeConsentementId getId() { return id; }
    public String getTokenHash() { return tokenHash; }
    public String getEnvoyeA() { return envoyeA; }

    public boolean isExpire() {
        return Instant.now().isAfter(expireAt);
    }
}
