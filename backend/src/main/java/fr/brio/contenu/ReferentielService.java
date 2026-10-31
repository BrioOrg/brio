package fr.brio.contenu;

import fr.brio.contenu.api.CompetenceDto;
import fr.brio.contenu.api.CompetenceLibelle;
import fr.brio.contenu.domain.Competence;
import fr.brio.contenu.infrastructure.CompetenceRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only access to the competency referential (ADR 0009) for authoring. The referential is
 * ingested at startup by {@code ReferentielIngestor}; here we only expose it, mapping entities to
 * {@link CompetenceDto} at the module edge. Only active codes are returned — deprecated ones would
 * be rejected at publication.
 */
@Service
public class ReferentielService {

    private final CompetenceRepository competenceRepository;

    ReferentielService(CompetenceRepository competenceRepository) {
        this.competenceRepository = competenceRepository;
    }

    @Transactional(readOnly = true)
    public List<CompetenceDto> competencesActives() {
        return competenceRepository.findByDeprecatedSinceIsNullOrderByCodeAsc().stream()
                .map(ReferentielService::toDto)
                .toList();
    }

    /** Every code's label, deprecated ones included (ADR 0009 keeps them forever). */
    @Transactional(readOnly = true)
    public List<CompetenceLibelle> libelles() {
        return competenceRepository.findAll().stream()
                .map(c -> new CompetenceLibelle(c.getCode(), c.getIntitule()))
                .toList();
    }

    private static CompetenceDto toDto(Competence c) {
        return new CompetenceDto(c.getCode(), c.getIntitule(), c.getDomaine(), c.getNiveaux());
    }
}
