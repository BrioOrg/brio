package fr.brio.devoirs.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Une pièce (photo/scan) déposée par l'élève sur son rendu (F5, ADR 0028). Le binaire vit hors base
 * (port de stockage) ; on garde ici les métadonnées et la clé opaque {@code storageKey}.
 */
@Entity
@Table(name = "rendu_pieces", schema = "devoirs")
public class RenduPiece {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "rendu_id", nullable = false)
    private UUID renduId;

    @Column(name = "storage_key", nullable = false)
    private String storageKey;

    @Column private String filename;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "taille_octets", nullable = false)
    private long tailleOctets;

    @Column(nullable = false)
    private int ordre;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    protected RenduPiece() {}

    public RenduPiece(
            UUID renduId,
            String storageKey,
            String filename,
            String contentType,
            long tailleOctets,
            int ordre) {
        this.renduId = renduId;
        this.storageKey = storageKey;
        this.filename = filename;
        this.contentType = contentType;
        this.tailleOctets = tailleOctets;
        this.ordre = ordre;
        this.uploadedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getRenduId() {
        return renduId;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getFilename() {
        return filename;
    }

    public String getContentType() {
        return contentType;
    }

    public long getTailleOctets() {
        return tailleOctets;
    }

    public int getOrdre() {
        return ordre;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }
}
