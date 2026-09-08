package fr.brio.identite.infrastructure;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "sessions")
class SessionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "compte_id", nullable = false)
    private UUID compteId;

    @Column(name = "cree_at", nullable = false, updatable = false)
    private Instant creeAt = Instant.now();

    @Column(name = "expire_at", nullable = false)
    private Instant expireAt;

    // Last octet removed for IPv4; last 64 bits zeroed for IPv6
    @Column(name = "ip_tronquee")
    private String ipTronquee;

    // SHA-256 hex digest — never stored in clear
    @Column(name = "user_agent_hash")
    private String userAgentHash;

    protected SessionAudit() {}

    static SessionAudit of(UUID compteId, Instant expireAt, String ipTronquee, String userAgentHash) {
        var s = new SessionAudit();
        s.compteId = compteId;
        s.expireAt = expireAt;
        s.ipTronquee = ipTronquee;
        s.userAgentHash = userAgentHash;
        return s;
    }
}
