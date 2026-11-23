package fr.brio.progression.api;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * What « Reprendre » proposes (ADR 0050 §5): a catalogue chapter or a teacher course, told apart
 * by {@code type}. The chapter variant keeps exactly its former fields, so a client that predates
 * courses still reads it. The client builds the link from the type and its ids.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
// The published contract names the wire values, not the schema names (V2, porte 5).
@Schema(
        discriminatorProperty = "type",
        discriminatorMapping = {
            @DiscriminatorMapping(value = "chapitre", schema = ChapitreAReprendre.class),
            @DiscriminatorMapping(value = "cours", schema = CoursAReprendre.class)
        })
@JsonSubTypes({
    @JsonSubTypes.Type(value = ChapitreAReprendre.class, name = "chapitre"),
    @JsonSubTypes.Type(value = CoursAReprendre.class, name = "cours")
})
public sealed interface ContenuAReprendre permits ChapitreAReprendre, CoursAReprendre {

    /** When the student last read a section of it — the most recent wins. */
    Instant derniereActivite();
}
