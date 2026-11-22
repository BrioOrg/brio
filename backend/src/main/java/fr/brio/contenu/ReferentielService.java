package fr.brio.contenu;

import fr.brio.contenu.api.CompetenceDto;
import fr.brio.contenu.api.CompetenceLibelle;
import fr.brio.contenu.domain.Competence;
import fr.brio.contenu.infrastructure.CompetenceRepository;
import fr.brio.contenu.infrastructure.ExerciceRepository;
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
    private final ExerciceRepository exerciceRepository;

    ReferentielService(CompetenceRepository competenceRepository, ExerciceRepository exerciceRepository) {
        this.competenceRepository = competenceRepository;
        this.exerciceRepository = exerciceRepository;
    }

    /**
     * The competencies worked by at least one annale exercise, for the student's « Par compétence »
     * view (#406). Deprecated codes are kept: an annale published under one still trains it, and
     * offering it is reading, not authoring. A code missing from the referential is left out.
     */
    @Transactional(readOnly = true)
    public List<CompetenceDto> competencesDesAnnales() {
        List<String> codes = exerciceRepository.findAnnaleCompetenceCodes();
        if (codes.isEmpty()) {
            return List.of();
        }
        return competenceRepository.findByCodeInOrderByCodeAsc(codes).stream()
                .map(ReferentielService::toDto)
                .toList();
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
