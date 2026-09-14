package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "consentements")
public class Consentement {

    @EmbeddedId
    private ConsentementId id;

    @Column(name = "donne_par_email", nullable = false)
    private String donneParEmail;

    @Column(name = "donne_at", nullable = false)
    private Instant donneAt;

    // SHA-256 hash of the confirmation bearer token — audit proof of which token was used.
    @Column(nullable = false)
    private String preuve;

    @Column(name = "revoque_at")
    private Instant revoqueAt;

    // Hash of the long-lived revocation bearer token sent to the parent.
    @Column(name = "revocation_token_hash")
    private String revocationTokenHash;

    @Column(name = "revocation_token_expire_at")
    private Instant revocationTokenExpireAt;

    protected Consentement() {}

    public static Consentement creer(UUID compteId, String type, String donneParEmail,
                                     String preuve, String revocationTokenHash) {
        var c = new Consentement();
        c.id = new ConsentementId(compteId, type);
        c.donneParEmail = donneParEmail;
        c.donneAt = Instant.now();
        c.preuve = preuve;
        c.revocationTokenHash = revocationTokenHash;
        return c;
    }

    public void revoquer() {
        this.revoqueAt = Instant.now();
    }

    public ConsentementId getId() { return id; }
    public boolean isRevoque() { return revoqueAt != null; }
    public String getRevocationTokenHash() { return revocationTokenHash; }
}
