package fr.brio.devoirs.infrastructure;

/**
 * Port de stockage des copies déposées (F5, ADR 0028). Le binaire vit hors base : le module ne
 * connaît qu'une clé opaque. L'implémentation livrée est locale (disque) pour le dev/les tests ; le
 * vrai stockage objet en UE sera une implémentation de déploiement branchée par configuration.
 */
public interface StockageCopies {

    /** Stocke le contenu et renvoie une clé opaque permettant de le relire. */
    String store(byte[] contenu, String contentType);

    /** Relit le contenu stocké pour une clé. */
    byte[] load(String key);

    /** Supprime le contenu stocké pour une clé (idempotent). */
    void delete(String key);
}
