package fr.brio.exercices.rediges;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

/** Private exercise photos use the same decode/re-encode principle as homework copies (ADR 0028). */
record PhotoCopie(String contentType, byte[] contenu) {
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final int MAX_SIDE = 6_000;
    private static final long MAX_PIXELS = 20_000_000;

    static PhotoCopie nettoyer(MultipartFile photo) {
        if (photo.isEmpty() || photo.getSize() > MAX_BYTES) {
            throw invalide("La photo doit faire au plus 5 Mo.");
        }
        String format = switch (photo.getContentType() == null ? "" : photo.getContentType()) {
            case "image/jpeg" -> "jpeg";
            case "image/png" -> "png";
            default -> throw invalide("Choisis une image JPEG ou PNG.");
        };

        try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(photo.getBytes()))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalide("Cette photo est illisible.");
            }
            ImageReader reader = readers.next();
            try {
                if (!format.equals(reader.getFormatName().toLowerCase(Locale.ROOT))) {
                    throw invalide("Le format de la photo ne correspond pas au fichier.");
                }
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || width > MAX_SIDE || height > MAX_SIDE
                        || (long) width * height > MAX_PIXELS) {
                    throw invalide("Cette photo est trop grande. Réduis ses dimensions.");
                }

                // Only pixel data reaches the writer. It never receives the source file's metadata.
                var bytes = new ByteArrayOutputStream();
                if (!ImageIO.write(reader.read(0), format, bytes)) {
                    throw invalide("Cette photo est illisible.");
                }
                if (bytes.size() > MAX_BYTES) {
                    throw invalide("Choisis une photo plus légère.");
                }
                return new PhotoCopie("image/" + format, bytes.toByteArray());
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw invalide("Cette photo est illisible.");
        }
    }

    private static ExerciceRedigeException invalide(String message) {
        return new ExerciceRedigeException(HttpStatus.UNPROCESSABLE_ENTITY, "PHOTO_INVALIDE", message);
    }
}
