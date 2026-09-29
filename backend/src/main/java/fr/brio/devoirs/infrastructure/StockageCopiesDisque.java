package fr.brio.devoirs.infrastructure;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Implémentation LOCALE (disque) du port {@link StockageCopies}, pour le dev et les tests. Écrit
 * chaque copie sous {@code brio.copies.dir} avec une clé opaque. Ce n'est PAS un stockage de prod
 * (pas d'URLs signées, pas de réplication) — le vrai stockage objet en UE sera branché au
 * déploiement (ADR 0028). Le contenu déposé a déjà été nettoyé (EXIF retiré) par le service.
 */
@Component
class StockageCopiesDisque implements StockageCopies {

    private final Path racine;

    StockageCopiesDisque(@Value("${brio.copies.dir:./data/copies}") String dir) {
        this.racine = Path.of(dir);
    }

    @Override
    public String store(byte[] contenu, String contentType) {
        String key = UUID.randomUUID() + extension(contentType);
        try {
            Files.createDirectories(racine);
            Files.write(racine.resolve(key), contenu);
        } catch (IOException e) {
            throw new UncheckedIOException("Échec du stockage de la copie", e);
        }
        return key;
    }

    @Override
    public byte[] load(String key) {
        try {
            return Files.readAllBytes(racine.resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de la lecture de la copie", e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(racine.resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de la suppression de la copie", e);
        }
    }

    private static String extension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "application/pdf" -> ".pdf";
            default -> "";
        };
    }
}
