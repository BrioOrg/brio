package fr.brio.devoirs;

import fr.brio.devoirs.domain.DerivationRendu;
import fr.brio.devoirs.domain.Devoir;
import fr.brio.devoirs.infrastructure.DevoirRepository;
import fr.brio.devoirs.infrastructure.RenduRepository;
import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionsQuery;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cœur métier des devoirs (F4, ADR 0020). Un enseignant crée un devoir pour une de ses classes ;
 * un élève voit ses devoirs et le statut de son rendu (dérivé de ses soumissions). Les autres
 * modules ne sont atteints que par leurs ports {@code api}, par identifiant.
 */
@Service
public class DevoirService {

    private final DevoirRepository devoirs;
    private final RenduRepository rendus;
    private final EnseignantContexteQuery enseignantContexte;
    private final InscriptionsQuery inscriptions;

    DevoirService(
            DevoirRepository devoirs,
            RenduRepository rendus,
            EnseignantContexteQuery enseignantContexte,
            InscriptionsQuery inscriptions) {
        this.devoirs = devoirs;
        this.rendus = rendus;
        this.enseignantContexte = enseignantContexte;
        this.inscriptions = inscriptions;
    }

    /** Crée un devoir. Refuse si l'auteur n'est pas l'enseignant de la classe visée. */
    @Transactional
    public UUID creerDevoir(UUID auteurId, NouveauDevoir nouveau) {
        if (!enseignantContexte.classesEnseignees(auteurId).contains(nouveau.classeId())) {
            throw new PasEnseignantDeLaClasseException(nouveau.classeId());
        }
        Devoir devoir =
                new Devoir(
                        nouveau.classeId(),
                        auteurId,
                        nouveau.titre(),
                        nouveau.consigne(),
                        nouveau.sourceType(),
                        nouveau.sourceRef(),
                        nouveau.sourceVersion(),
                        nouveau.exerciceIds(),
                        nouveau.ouvreAt(),
                        nouveau.echeanceAt());
        return devoirs.save(devoir).getId();
    }

    /** Les devoirs publiés des classes de l'élève, avec le statut de son rendu pour chacun. */
    @Transactional(readOnly = true)
    public List<DevoirEleveVue> listerPourEleve(UUID eleveId) {
        Set<UUID> classes = inscriptions.classesDeLEleve(eleveId);
        if (classes.isEmpty()) {
            return List.of();
        }
        List<Devoir> liste = devoirs.findByClasseIdInAndStatut(classes, "publie");
        Map<UUID, String> statutsRendu =
                rendus
                        .findByEleveIdAndDevoirIdIn(eleveId, liste.stream().map(Devoir::getId).toList())
                        .stream()
                        .collect(Collectors.toMap(r -> r.getDevoirId(), r -> r.getStatut()));
        return liste.stream()
                .map(
                        d ->
                                new DevoirEleveVue(
                                        d.getId(),
                                        d.getTitre(),
                                        d.getConsigne(),
                                        d.getEcheanceAt(),
                                        d.nombreExercices(),
                                        statutsRendu.getOrDefault(d.getId(), DerivationRendu.NON_COMMENCE)))
                .toList();
    }

    /** Le détail d'un devoir. */
    @Transactional(readOnly = true)
    public DevoirDetail getDevoir(UUID id) {
        return devoirs
                .findById(id)
                .map(mapperDetail())
                .orElseThrow(() -> new DevoirNotFoundException(id));
    }

    private static Function<Devoir, DevoirDetail> mapperDetail() {
        return d ->
                new DevoirDetail(
                        d.getId(),
                        d.getClasseId(),
                        d.getTitre(),
                        d.getConsigne(),
                        d.getType(),
                        d.getSourceType(),
                        d.getSourceRef(),
                        d.getExerciceIds(),
                        d.getOuvreAt(),
                        d.getEcheanceAt(),
                        d.getCorrectionVisibleAt(),
                        d.getStatut());
    }
}
