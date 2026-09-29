package fr.brio.devoirs;

import fr.brio.devoirs.TableauDeBordDevoir.LigneEleve;
import fr.brio.devoirs.domain.DerivationRendu;
import fr.brio.devoirs.domain.Devoir;
import fr.brio.devoirs.domain.Rendu;
import fr.brio.devoirs.domain.RenduExercice;
import fr.brio.devoirs.domain.RenduPiece;
import fr.brio.devoirs.domain.TableauDeBord;
import fr.brio.devoirs.infrastructure.RenduPieceRepository;
import fr.brio.devoirs.infrastructure.StockageCopies;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import javax.imageio.ImageIO;
import fr.brio.devoirs.domain.TableauDeBord.ReussiteCompetence;
import fr.brio.devoirs.domain.TableauDeBord.ScoreCompetence;
import fr.brio.devoirs.infrastructure.DevoirRepository;
import fr.brio.devoirs.infrastructure.RenduExerciceRepository;
import fr.brio.devoirs.infrastructure.RenduRepository;
import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionInfo;
import fr.brio.identite.api.InscriptionsQuery;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.OptionalDouble;
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
    private final RenduExerciceRepository renduExercices;
    private final EnseignantContexteQuery enseignantContexte;
    private final InscriptionsQuery inscriptions;
    private final RenduPieceRepository renduPieces;
    private final StockageCopies stockage;

    DevoirService(
            DevoirRepository devoirs,
            RenduRepository rendus,
            RenduExerciceRepository renduExercices,
            EnseignantContexteQuery enseignantContexte,
            InscriptionsQuery inscriptions,
            RenduPieceRepository renduPieces,
            StockageCopies stockage) {
        this.devoirs = devoirs;
        this.rendus = rendus;
        this.renduExercices = renduExercices;
        this.enseignantContexte = enseignantContexte;
        this.inscriptions = inscriptions;
        this.renduPieces = renduPieces;
        this.stockage = stockage;
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
                        nouveau.type(),
                        nouveau.sourceType(),
                        nouveau.sourceRef(),
                        nouveau.sourceVersion(),
                        nouveau.exerciceIds(),
                        nouveau.ouvreAt(),
                        nouveau.echeanceAt());
        return devoirs.save(devoir).getId();
    }

    /**
     * Vrai si l'élève a un contrôle ouvert et non encore rendu (mode contrôle, ADR 0025). Sert au
     * tuteur (module {@code ia}) pour se couper pendant un contrôle.
     */
    @Transactional(readOnly = true)
    public boolean enControleOuvert(UUID eleveId) {
        return controleActifDevoir(eleveId).isPresent();
    }

    /** Le contrôle actif de l'élève (pour verrouiller/afficher côté interface), s'il y en a un. */
    @Transactional(readOnly = true)
    public ControleActif controleActif(UUID eleveId) {
        return controleActifDevoir(eleveId)
                .map(d -> new ControleActif(true, d.getTitre(), d.getEcheanceAt()))
                .orElseGet(() -> new ControleActif(false, null, null));
    }

    private Optional<Devoir> controleActifDevoir(UUID eleveId) {
        Set<UUID> classes = inscriptions.classesDeLEleve(eleveId);
        if (classes.isEmpty()) {
            return Optional.empty();
        }
        return devoirs.findControlesOuverts(classes, Instant.now()).stream()
                .filter(
                        d ->
                                rendus
                                        .findByDevoirIdAndEleveId(d.getId(), eleveId)
                                        .map(r -> !DerivationRendu.RENDU.equals(r.getStatut()))
                                        .orElse(true))
                .findFirst();
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

    /** Les devoirs d'une classe (vue enseignant). Refuse si le demandeur n'est pas l'enseignant. */
    @Transactional(readOnly = true)
    public List<DevoirClasseVue> listerPourClasse(UUID classeId, UUID demandeurId) {
        if (!enseignantContexte.classesEnseignees(demandeurId).contains(classeId)) {
            throw new PasEnseignantDeLaClasseException(classeId);
        }
        return devoirs.findByClasseIdOrderByEcheanceAtAsc(classeId).stream()
                .map(
                        d ->
                                new DevoirClasseVue(
                                        d.getId(),
                                        d.getTitre(),
                                        d.getOuvreAt(),
                                        d.getEcheanceAt(),
                                        d.getStatut(),
                                        d.nombreExercices()))
                .toList();
    }

    /**
     * Le tableau de bord d'un devoir pour son enseignant : le roster complet de la classe (y compris
     * les élèves « pas commencé »), les compteurs, et la réussite par compétence. Refuse si le
     * demandeur n'est pas l'enseignant de la classe.
     */
    @Transactional(readOnly = true)
    public TableauDeBordDevoir tableauDeBord(UUID devoirId, UUID demandeurId) {
        Devoir devoir =
                devoirs.findById(devoirId).orElseThrow(() -> new DevoirNotFoundException(devoirId));
        if (!enseignantContexte.classesEnseignees(demandeurId).contains(devoir.getClasseId())) {
            throw new PasEnseignantDeLaClasseException(devoir.getClasseId());
        }

        List<InscriptionInfo> roster = inscriptions.elevesDeLaClasse(devoir.getClasseId());
        List<Rendu> rendusDevoir = rendus.findByDevoirId(devoirId);
        Map<UUID, Rendu> parEleve =
                rendusDevoir.stream().collect(Collectors.toMap(Rendu::getEleveId, r -> r));

        List<LigneEleve> lignes =
                roster.stream()
                        .map(
                                i -> {
                                    Rendu r = parEleve.get(i.compteId());
                                    String statut = r != null ? r.getStatut() : DerivationRendu.NON_COMMENCE;
                                    Double score = r != null ? r.getScore() : null;
                                    return new LigneEleve(i.compteId(), i.nomAffiche(), statut, score);
                                })
                        .toList();

        int total = lignes.size();
        int nbRendu = (int) lignes.stream().filter(l -> DerivationRendu.RENDU.equals(l.statut())).count();
        int nbEnCours =
                (int) lignes.stream().filter(l -> DerivationRendu.EN_COURS.equals(l.statut())).count();
        int nbNonCommence = total - nbRendu - nbEnCours;
        OptionalDouble moyenneOpt =
                lignes.stream()
                        .map(LigneEleve::score)
                        .filter(Objects::nonNull)
                        .mapToDouble(Double::doubleValue)
                        .average();
        Double moyenne = moyenneOpt.isPresent() ? moyenneOpt.getAsDouble() : null;

        List<UUID> renduIds = rendusDevoir.stream().map(Rendu::getId).toList();
        List<RenduExercice> faits =
                renduIds.isEmpty() ? List.of() : renduExercices.findByRenduIdIn(renduIds);
        List<ScoreCompetence> scores =
                faits.stream()
                        .flatMap(
                                re ->
                                        re.getCompetencies().stream()
                                                .map(code -> new ScoreCompetence(code, re.getScore())))
                        .toList();
        List<ReussiteCompetence> parCompetence = TableauDeBord.parCompetence(scores);

        return new TableauDeBordDevoir(
                devoir.getId(),
                devoir.getTitre(),
                devoir.getEcheanceAt(),
                total,
                nbRendu,
                nbEnCours,
                nbNonCommence,
                moyenne,
                lignes,
                parCompetence);
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

    // --- F5 : dépôt et correction de copie (ADR 0028) ---

    private static final long TAILLE_MAX_OCTETS = 10L * 1024 * 1024; // 10 Mo
    private static final int PIECES_MAX = 5;
    private static final Set<String> TYPES_ACCEPTES =
            Set.of("image/jpeg", "image/png", "application/pdf");

    /** L'élève dépose une pièce (photo/scan) sur son rendu (créé si besoin). */
    @Transactional
    public PieceInfo deposerPiece(
            UUID eleveId, UUID devoirId, byte[] contenu, String contentType, String filename) {
        if (contentType == null || !TYPES_ACCEPTES.contains(contentType)) {
            throw new PieceInvalideException("Format non accepté : JPEG, PNG ou PDF uniquement.");
        }
        if (contenu == null || contenu.length == 0) {
            throw new PieceInvalideException("Fichier vide.");
        }
        if (contenu.length > TAILLE_MAX_OCTETS) {
            throw new PieceInvalideException("Fichier trop volumineux (10 Mo maximum).");
        }
        devoirs.findById(devoirId).orElseThrow(() -> new DevoirNotFoundException(devoirId));

        Rendu rendu =
                rendus
                        .findByDevoirIdAndEleveId(devoirId, eleveId)
                        .orElseGet(() -> rendus.save(new Rendu(devoirId, eleveId)));
        if (renduPieces.countByRenduId(rendu.getId()) >= PIECES_MAX) {
            throw new PieceInvalideException("Trop de copies (5 maximum).");
        }

        byte[] propre = nettoyer(contenu, contentType);
        String key = stockage.store(propre, contentType);
        int ordre = renduPieces.countByRenduId(rendu.getId());
        RenduPiece piece =
                renduPieces.save(
                        new RenduPiece(rendu.getId(), key, filename, contentType, propre.length, ordre));
        return toInfo(piece);
    }

    /** Les copies déposées par un élève, pour l'enseignant du devoir. */
    @Transactional(readOnly = true)
    public List<PieceInfo> listerPiecesPourProf(UUID devoirId, UUID eleveId, UUID demandeurId) {
        Devoir devoir =
                devoirs.findById(devoirId).orElseThrow(() -> new DevoirNotFoundException(devoirId));
        if (!enseignantContexte.classesEnseignees(demandeurId).contains(devoir.getClasseId())) {
            throw new PasEnseignantDeLaClasseException(devoir.getClasseId());
        }
        return rendus
                .findByDevoirIdAndEleveId(devoirId, eleveId)
                .map(r -> renduPieces.findByRenduIdOrderByOrdreAsc(r.getId()))
                .orElseGet(List::of)
                .stream()
                .map(DevoirService::toInfo)
                .toList();
    }

    /** L'enseignant corrige le rendu d'un élève (note + appréciation). Crée le rendu si besoin. */
    @Transactional
    public void corrigerRendu(
            UUID devoirId, UUID eleveId, UUID demandeurId, BigDecimal note, String appreciation) {
        Devoir devoir =
                devoirs.findById(devoirId).orElseThrow(() -> new DevoirNotFoundException(devoirId));
        if (!enseignantContexte.classesEnseignees(demandeurId).contains(devoir.getClasseId())) {
            throw new PasEnseignantDeLaClasseException(devoir.getClasseId());
        }
        Rendu rendu =
                rendus
                        .findByDevoirIdAndEleveId(devoirId, eleveId)
                        .orElseGet(() -> rendus.save(new Rendu(devoirId, eleveId)));
        rendu.corriger(note, appreciation, demandeurId);
        rendus.save(rendu);
    }

    /** Sert une pièce, réservée à l'élève auteur OU à l'enseignant du devoir (sinon refus). */
    @Transactional(readOnly = true)
    public ContenuPiece chargerPiece(UUID pieceId, UUID demandeurId) {
        RenduPiece piece =
                renduPieces.findById(pieceId).orElseThrow(() -> new PieceNotFoundException(pieceId));
        Rendu rendu =
                rendus
                        .findById(piece.getRenduId())
                        .orElseThrow(() -> new PieceNotFoundException(pieceId));
        Devoir devoir =
                devoirs
                        .findById(rendu.getDevoirId())
                        .orElseThrow(() -> new PieceNotFoundException(pieceId));
        boolean auteur = rendu.getEleveId().equals(demandeurId);
        boolean enseignant =
                enseignantContexte.classesEnseignees(demandeurId).contains(devoir.getClasseId());
        if (!auteur && !enseignant) {
            throw new AccesPieceRefuseException();
        }
        return new ContenuPiece(
                stockage.load(piece.getStorageKey()), piece.getContentType(), piece.getFilename());
    }

    private static PieceInfo toInfo(RenduPiece p) {
        return new PieceInfo(
                p.getId(), p.getFilename(), p.getContentType(), p.getTailleOctets(), p.getUploadedAt());
    }

    /** Retire l'EXIF des images en les ré-encodant ; les PDF passent tels quels (ADR 0028). */
    private static byte[] nettoyer(byte[] contenu, String contentType) {
        if (!contentType.startsWith("image/")) {
            return contenu;
        }
        String format = contentType.equals("image/png") ? "png" : "jpg";
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(contenu));
            if (image == null) {
                throw new PieceInvalideException("Image illisible.");
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (!ImageIO.write(image, format, out)) {
                throw new PieceInvalideException("Format d'image non pris en charge.");
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new PieceInvalideException("Image illisible.");
        }
    }
}
