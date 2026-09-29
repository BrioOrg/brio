package fr.brio.contenu;

import fr.brio.contenu.domain.Annale;
import fr.brio.contenu.domain.Chapitre;
import fr.brio.contenu.domain.ExamenSession;
import fr.brio.contenu.infrastructure.AnnaleRepository;
import fr.brio.contenu.infrastructure.ChapitreRepository;
import fr.brio.contenu.infrastructure.ExamenSessionRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mode examen des annales (F7, ADR 0027) : sessions chronométrées initiées par l'élève. Tant qu'une
 * session est ouverte, le tuteur est coupé (via {@code ExamenQuery}) et la correction reste cachée.
 */
@Service
public class ExamenService {

  /** Durée par défaut si l'annale ne précise pas de durée. */
  private static final int DUREE_DEFAUT_MINUTES = 120;

  private final ExamenSessionRepository sessions;
  private final AnnaleRepository annales;
  private final ChapitreRepository chapitres;

  ExamenService(
      ExamenSessionRepository sessions, AnnaleRepository annales, ChapitreRepository chapitres) {
    this.sessions = sessions;
    this.annales = annales;
    this.chapitres = chapitres;
  }

  /** Démarre (ou récupère) la session d'examen de l'élève sur une annale. */
  @Transactional
  public ExamenDemarre demarrer(UUID eleveId, String annaleChapitreId) {
    Annale annale =
        annales
            .findById(annaleChapitreId)
            .orElseThrow(() -> new AnnaleIntrouvableException(annaleChapitreId));
    Instant now = Instant.now();
    var existante =
        sessions.findFirstByEleveIdAndAnnaleChapitreIdAndStatutAndEndsAtAfter(
            eleveId, annaleChapitreId, ExamenSession.EN_COURS, now);
    if (existante.isPresent()) {
      ExamenSession s = existante.get();
      return new ExamenDemarre(s.getId(), s.getEndsAt());
    }
    int duree = annale.getDureeMinutes() != null ? annale.getDureeMinutes() : DUREE_DEFAUT_MINUTES;
    ExamenSession s =
        sessions.save(
            new ExamenSession(eleveId, annaleChapitreId, now, now.plusSeconds(duree * 60L)));
    return new ExamenDemarre(s.getId(), s.getEndsAt());
  }

  /** Termine la session (rendu explicite). Idempotent. */
  @Transactional
  public void rendre(UUID sessionId, UUID eleveId) {
    ExamenSession s =
        sessions
            .findById(sessionId)
            .filter(x -> x.getEleveId().equals(eleveId))
            .orElseThrow(() -> new ExamenIntrouvableException(sessionId));
    if (ExamenSession.EN_COURS.equals(s.getStatut())) {
      s.terminer(Instant.now());
      sessions.save(s);
    }
  }

  /** La session d'examen en cours de l'élève, le cas échéant. */
  @Transactional(readOnly = true)
  public ExamenActif actif(UUID eleveId) {
    return sessions
        .findFirstByEleveIdAndStatutAndEndsAtAfterOrderByStartedAtDesc(
            eleveId, ExamenSession.EN_COURS, Instant.now())
        .map(
            s -> {
              String titre =
                  chapitres.findById(s.getAnnaleChapitreId()).map(Chapitre::getTitre).orElse(null);
              return new ExamenActif(
                  true, s.getId().toString(), s.getAnnaleChapitreId(), titre, s.getEndsAt());
            })
        .orElse(new ExamenActif(false, null, null, null, null));
  }

  /** Vrai si l'élève a un examen ouvert (garde tuteur, ADR 0025/0027). */
  @Transactional(readOnly = true)
  public boolean enExamenOuvert(UUID eleveId) {
    return sessions.existsByEleveIdAndStatutAndEndsAtAfter(
        eleveId, ExamenSession.EN_COURS, Instant.now());
  }
}
