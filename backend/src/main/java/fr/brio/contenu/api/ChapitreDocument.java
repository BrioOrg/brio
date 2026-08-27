package fr.brio.contenu.api;

import java.util.List;
import java.util.Optional;

public record ChapitreDocument(String id, List<Section> sections) {

    /**
     * Resolves a citation path of the form "sectionId/blockId" to its block,
     * or empty if the path doesn't match any block in this document.
     */
    public Optional<Block> findBlock(String citationPath) {
        String[] parts = citationPath.split("/", 2);
        if (parts.length != 2) {
            return Optional.empty();
        }
        String sectionId = parts[0];
        String blockId = parts[1];
        return sections.stream()
                .filter(s -> s.id().equals(sectionId))
                .flatMap(s -> s.blocks().stream())
                .filter(b -> b.id().equals(blockId))
                .findFirst();
    }
}
