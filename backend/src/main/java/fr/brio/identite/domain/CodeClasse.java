package fr.brio.identite.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "identite", name = "codes_classes")
public class CodeClasse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "code_hash", nullable = false, unique = true)
    private String codeHash;

    @Column(name = "classe_id", nullable = false)
    private UUID classeId;

    @Column(name = "cree_par", nullable = false)
    private UUID creePar;

    @Column(name = "expire_at", nullable = false)
    private Instant expireAt;

    @Column(name = "usages_max", nullable = false)
    private int usagesMax;

    @Column(nullable = false)
    private int usages = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected CodeClasse() {}

    public static CodeClasse creer(String codeHash, UUID classeId, UUID creePar,
                                    Instant expireAt, int usagesMax) {
        var c = new CodeClasse();
        c.codeHash = codeHash;
        c.classeId = classeId;
        c.creePar = creePar;
        c.expireAt = expireAt;
        c.usagesMax = usagesMax;
        return c;
    }

    public boolean estExpire() {
        return Instant.now().isAfter(expireAt);
    }

    public boolean estEpuise() {
        return usages >= usagesMax;
    }

    public void enregistrerUsage() {
        this.usages++;
    }

    public UUID getId() { return id; }
    public String getCodeHash() { return codeHash; }
    public UUID getClasseId() { return classeId; }
    public UUID getCreePar() { return creePar; }
    public Instant getExpireAt() { return expireAt; }
    public int getUsagesMax() { return usagesMax; }
    public int getUsages() { return usages; }
}
