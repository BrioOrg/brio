package fr.brio.exercices.rediges;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.metadata.IIOMetadataNode;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class PhotoCopieTest {
    @Test
    void stripsMetadataWhileKeepingThePixels() throws Exception {
        var source = new BufferedImage(3, 4, BufferedImage.TYPE_INT_RGB);
        source.setRGB(1, 1, 0xff123456);
        var writer = ImageIO.getImageWritersByFormatName("png").next();
        var bytes = new ByteArrayOutputStream();
        try (var output = ImageIO.createImageOutputStream(bytes)) {
            var options = writer.getDefaultWriteParam();
            var metadata = writer.getDefaultImageMetadata(ImageTypeSpecifier.createFromRenderedImage(source), options);
            var root = new IIOMetadataNode("javax_imageio_png_1.0");
            var text = new IIOMetadataNode("tEXt");
            var entry = new IIOMetadataNode("tEXtEntry");
            entry.setAttribute("keyword", "Test");
            entry.setAttribute("value", "private-location");
            text.appendChild(entry);
            root.appendChild(text);
            metadata.mergeTree(root.getNodeName(), root);
            writer.setOutput(output);
            writer.write(null, new IIOImage(source, null, metadata), options);
        } finally {
            writer.dispose();
        }

        byte[] original = bytes.toByteArray();
        assertThat(new String(original, StandardCharsets.ISO_8859_1)).contains("private-location");
        var cleaned = PhotoCopie.nettoyer(new MockMultipartFile("photo", "copy.png", "image/png", original));
        assertThat(cleaned.contentType()).isEqualTo("image/png");
        assertThat(new String(cleaned.contenu(), StandardCharsets.ISO_8859_1)).doesNotContain("private-location");
        var decoded = ImageIO.read(new ByteArrayInputStream(cleaned.contenu()));
        assertThat(decoded.getWidth()).isEqualTo(3);
        assertThat(decoded.getHeight()).isEqualTo(4);
        assertThat(decoded.getRGB(1, 1)).isEqualTo(source.getRGB(1, 1));
    }

    @Test
    void rejectsWrongFormatAndCorruptOrOversizedImages() throws Exception {
        var png = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB), "png", png);
        assertThatThrownBy(() -> PhotoCopie.nettoyer(
                new MockMultipartFile("photo", "copy.jpg", "image/jpeg", png.toByteArray())))
                .isInstanceOf(ExerciceRedigeException.class);
        assertThatThrownBy(() -> PhotoCopie.nettoyer(
                new MockMultipartFile("photo", "copy.png", "image/png", new byte[] {7, 9})))
                .isInstanceOf(ExerciceRedigeException.class);
        assertThatThrownBy(() -> PhotoCopie.nettoyer(
                new MockMultipartFile("photo", "copy.png", "image/png", new byte[5 * 1024 * 1024 + 1])))
                .isInstanceOf(ExerciceRedigeException.class);

        var tooHigh = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(1, 6_001, BufferedImage.TYPE_INT_RGB), "png", tooHigh);
        assertThatThrownBy(() -> PhotoCopie.nettoyer(
                new MockMultipartFile("photo", "copy.png", "image/png", tooHigh.toByteArray())))
                .isInstanceOf(ExerciceRedigeException.class).hasMessageContaining("dimensions");
    }
}
