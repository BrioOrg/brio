package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import fr.brio.identite.api.ProfilEleve;
import fr.brio.identite.api.ProfilsElevesQuery;
import fr.brio.social.api.ReponseUtileRevoquee;
import fr.brio.social.domain.CibleCommunaute;
import fr.brio.social.domain.ContestationModeration;
import fr.brio.social.domain.DecisionModeration;
import fr.brio.social.domain.QuestionCommunaute;
import fr.brio.social.domain.ReponseCommunaute;
import fr.brio.social.domain.SignalementCommunaute;
import fr.brio.social.infrastructure.ContestationModerationRepository;
import fr.brio.social.infrastructure.DecisionModerationRepository;
import fr.brio.social.infrastructure.QuestionCommunauteRepository;
import fr.brio.social.infrastructure.ReponseCommunauteRepository;
import fr.brio.social.infrastructure.SignalementCommunauteRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

class ModerationCommunauteServiceTest {

    private SignalementCommunauteRepository signalements;
    private DecisionModerationRepository decisions;
    private ContestationModerationRepository contestations;
    private QuestionCommunauteRepository questions;
    private ReponseCommunauteRepository reponses;
    private ProfilsElevesQuery profils;
    private ApplicationEventPublisher evenements;
    private ModerationCommunauteService service;

    @BeforeEach
    void setUp() {
        signalements = mock(SignalementCommunauteRepository.class);
        decisions = mock(DecisionModerationRepository.class);
        contestations = mock(ContestationModerationRepository.class);
        questions = mock(QuestionCommunauteRepository.class);
        reponses = mock(ReponseCommunauteRepository.class);
        profils = mock(ProfilsElevesQuery.class);
        evenements = mock(ApplicationEventPublisher.class);
        service = new ModerationCommunauteService(
                signalements, decisions, contestations, questions, reponses,
                profils, evenements, new ObjectMapper());
        // decisions.save renvoie l'entité avec un id, comme en base.
        when(decisions.save(any())).thenAnswer(invocation -> {
            DecisionModeration d = mock(DecisionModeration.class);
            when(d.getId()).thenReturn(UUID.randomUUID());
            return d;
        });
    }

    // ---- signalement -------------------------------------------------------

    @Test
    void signaler_enregistre_un_signalement_sur_un_contenu_visible() {
        UUID questionId = UUID.randomUUID();
        UUID membre = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(true);
        when(q.getAuteurId()).thenReturn(UUID.randomUUID());
        when(q.getTitre()).thenReturn("Titre lu au signalement");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(signalements.existsByCibleTypeAndCibleIdAndSignaleParAndStatut("question", questionId, membre, "ouvert"))
                .thenReturn(false);

        service.signaler(CibleCommunaute.QUESTION, questionId, membre, "spam");

        ArgumentCaptor<SignalementCommunaute> captor = ArgumentCaptor.forClass(SignalementCommunaute.class);
        verify(signalements).save(captor.capture());
        assertThat(captor.getValue().getCible()).isEqualTo(CibleCommunaute.QUESTION);
        assertThat(captor.getValue().getMotif()).isEqualTo("spam");
        assertThat(captor.getValue().getExtrait()).isEqualTo("Titre lu au signalement");
    }

    @Test
    void signaler_est_idempotent_par_membre() {
        UUID questionId = UUID.randomUUID();
        UUID membre = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(true);
        when(q.getAuteurId()).thenReturn(UUID.randomUUID());
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(signalements.existsByCibleTypeAndCibleIdAndSignaleParAndStatut("question", questionId, membre, "ouvert"))
                .thenReturn(true);

        service.signaler(CibleCommunaute.QUESTION, questionId, membre, null);

        verify(signalements, never()).save(any());
    }

    @Test
    void signaler_un_contenu_deja_masque_est_introuvable() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(false);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() ->
                        service.signaler(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), null))
                .isInstanceOf(MessageCommunauteNotFoundException.class);
    }

    // ---- décisions ---------------------------------------------------------

    @Test
    void decider_masquer_masque_la_question_et_clot_ses_signalements() {
        UUID questionId = UUID.randomUUID();
        UUID admin = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        SignalementCommunaute ouvert =
                new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), null, null);
        when(signalements.findByCibleTypeAndCibleIdAndStatut("question", questionId, "ouvert"))
                .thenReturn(List.of(ouvert));

        service.decider(CibleCommunaute.QUESTION, questionId, admin, DecisionModeration.ACTION_MASQUER, "hors sujet");

        verify(q).masquer();
        ArgumentCaptor<DecisionModeration> captor = ArgumentCaptor.forClass(DecisionModeration.class);
        verify(decisions).save(captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo(DecisionModeration.ACTION_MASQUER);
        assertThat(ouvert.getStatut()).isEqualTo(SignalementCommunaute.STATUT_TRAITE);
    }

    @Test
    void decider_supprimer_supprime_la_reponse() {
        UUID reponseId = UUID.randomUUID();
        ReponseCommunaute r = mock(ReponseCommunaute.class);
        when(reponses.findById(reponseId)).thenReturn(Optional.of(r));

        service.decider(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_SUPPRIMER, null);

        verify(r).supprimer();
    }

    @Test
    void decider_revoquer_xp_publie_levenement_pour_le_repondeur() {
        UUID reponseId = UUID.randomUUID();
        UUID repondeur = UUID.randomUUID();
        reponseRetenue(reponseId, repondeur);

        service.decider(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_REVOQUER_XP, null);

        ArgumentCaptor<ReponseUtileRevoquee> captor = ArgumentCaptor.forClass(ReponseUtileRevoquee.class);
        verify(evenements).publishEvent(captor.capture());
        assertThat(captor.getValue().repondeurId()).isEqualTo(repondeur);
        assertThat(captor.getValue().reponseId()).isEqualTo(reponseId);
    }

    @Test
    void decider_revoquer_xp_sur_une_question_est_refuse() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() -> service.decider(
                        CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), DecisionModeration.ACTION_REVOQUER_XP, null))
                .isInstanceOf(MessageInvalideException.class);
        verify(evenements, never()).publishEvent(any());
    }

    @Test
    void decider_action_inconnue_est_refusee() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() ->
                        service.decider(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), "banane", null))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void decider_sur_un_contenu_disparu_est_introuvable() {
        UUID reponseId = UUID.randomUUID();
        when(reponses.findById(reponseId)).thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                        service.decider(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_MASQUER, null))
                .isInstanceOf(MessageCommunauteNotFoundException.class);
    }

    // ---- contestation ------------------------------------------------------

    @Test
    void contester_par_un_non_auteur_est_refuse() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(UUID.randomUUID());
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() ->
                        service.contester(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), "pas d'accord"))
                .isInstanceOf(AccesCommunauteRefuseException.class);
    }

    @Test
    void contester_sans_decision_contestable_est_refuse() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(auteur);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(decisions.findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(any(), any(), any()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() ->
                        service.contester(CibleCommunaute.QUESTION, questionId, auteur, "pas d'accord"))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void contester_enregistre_la_contestation() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(auteur);
        when(q.getStatut()).thenReturn("masque");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        DecisionModeration decision = mock(DecisionModeration.class);
        UUID decisionId = UUID.randomUUID();
        when(decision.getId()).thenReturn(decisionId);
        when(decisions.findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(any(), any(), any()))
                .thenReturn(Optional.of(decision));
        when(contestations.existsByDecisionId(decisionId)).thenReturn(false);
        when(contestations.save(any())).thenAnswer(i -> i.getArgument(0));

        service.contester(CibleCommunaute.QUESTION, questionId, auteur, "  ma question était correcte  ");

        ArgumentCaptor<ContestationModeration> captor = ArgumentCaptor.forClass(ContestationModeration.class);
        verify(contestations).save(captor.capture());
        assertThat(captor.getValue().getMessage()).isEqualTo("ma question était correcte");
        assertThat(captor.getValue().getDecisionId()).isEqualTo(decisionId);
    }

    @Test
    void contester_deux_fois_la_meme_decision_est_refuse() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(auteur);
        when(q.getStatut()).thenReturn("masque");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        DecisionModeration decision = mock(DecisionModeration.class);
        UUID decisionId = UUID.randomUUID();
        when(decision.getId()).thenReturn(decisionId);
        when(decisions.findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(any(), any(), any()))
                .thenReturn(Optional.of(decision));
        when(contestations.existsByDecisionId(decisionId)).thenReturn(true);

        assertThatThrownBy(() -> service.contester(CibleCommunaute.QUESTION, questionId, auteur, "encore"))
                .isInstanceOf(MessageInvalideException.class);
    }

    // ---- traitement d'une contestation -------------------------------------

    @Test
    void trancher_en_acceptant_restaure_le_contenu() {
        UUID contestationId = UUID.randomUUID();
        UUID cibleId = UUID.randomUUID();
        UUID admin = UUID.randomUUID();
        ContestationModeration contestation = mock(ContestationModeration.class);
        when(contestation.estOuverte()).thenReturn(true);
        when(contestation.getCible()).thenReturn(CibleCommunaute.QUESTION);
        when(contestation.getCibleId()).thenReturn(cibleId);
        when(contestations.findById(contestationId)).thenReturn(Optional.of(contestation));
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getStatut()).thenReturn("masque");
        when(questions.findById(cibleId)).thenReturn(Optional.of(q));

        service.trancherContestation(contestationId, admin, true, "tu as raison");

        verify(q).restaurer();
        ArgumentCaptor<DecisionModeration> captor = ArgumentCaptor.forClass(DecisionModeration.class);
        verify(decisions).save(captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo(DecisionModeration.ACTION_RESTAURER);
        verify(contestation).trancher(eq(true), eq("tu as raison"), eq(admin), any());
    }

    @Test
    void trancher_en_rejetant_ne_restaure_rien() {
        UUID contestationId = UUID.randomUUID();
        ContestationModeration contestation = mock(ContestationModeration.class);
        when(contestation.estOuverte()).thenReturn(true);
        when(contestations.findById(contestationId)).thenReturn(Optional.of(contestation));

        service.trancherContestation(contestationId, UUID.randomUUID(), false, "non");

        verify(decisions, never()).save(any());
        verify(contestation).trancher(eq(false), eq("non"), any(), any());
    }

    @Test
    void trancher_une_contestation_deja_close_est_refuse() {
        UUID contestationId = UUID.randomUUID();
        ContestationModeration contestation = mock(ContestationModeration.class);
        when(contestation.estOuverte()).thenReturn(false);
        when(contestations.findById(contestationId)).thenReturn(Optional.of(contestation));

        assertThatThrownBy(() ->
                        service.trancherContestation(contestationId, UUID.randomUUID(), true, "trop tard"))
                .isInstanceOf(MessageInvalideException.class);
    }

    // ---- file de signalements ----------------------------------------------

    @Test
    void file_agrege_les_signalements_par_cible() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        SignalementCommunaute s1 = new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), "spam", "Une question ?");
        SignalementCommunaute s2 = new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), null, null);
        when(signalements.findByStatutOrderByCreatedAtAsc("ouvert")).thenReturn(List.of(s1, s2));
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(auteur);
        when(q.getTitre()).thenReturn("Une question");
        when(q.getStatut()).thenReturn("publie");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(profils.profils(anySet())).thenReturn(Map.of(auteur, new ProfilEleve("Renard-Turquoise", "3e")));

        List<SignalementCommunauteVue> file = service.fileSignalements();

        assertThat(file).hasSize(1);
        SignalementCommunauteVue vue = file.get(0);
        assertThat(vue.cibleType()).isEqualTo("question");
        assertThat(vue.nombreSignalements()).isEqualTo(2);
        assertThat(vue.motifs()).containsExactly("spam");
        assertThat(vue.auteurPseudonyme()).isEqualTo("Renard-Turquoise");
        assertThat(vue.extrait()).isEqualTo("Une question");
        assertThat(vue.extraitAuSignalement()).isEqualTo("Une question ?");
    }

    @Test
    void file_marque_lxp_deja_revoquee_dune_reponse() {
        UUID reponseId = UUID.randomUUID();
        UUID repondeur = UUID.randomUUID();
        reponseRetenue(reponseId, repondeur);
        when(signalements.findByStatutOrderByCreatedAtAsc("ouvert")).thenReturn(List.of(
                new SignalementCommunaute(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), null, null)));
        when(decisions.existsByCibleTypeAndCibleIdAndAction("reponse", reponseId, "revoquer_xp")).thenReturn(true);
        when(profils.profils(anySet())).thenReturn(Map.of());

        SignalementCommunauteVue vue = service.fileSignalements().get(0);

        assertThat(vue.estReponseResolue()).isTrue();
        assertThat(vue.xpDejaRevoquee()).isTrue();
        assertThat(vue.auteurPseudonyme()).isEqualTo("Membre");
    }

    // ---- porte 5 : règles serveur ajoutées (#338) ------------------------------------

    @Test
    void signaler_son_propre_contenu_est_refuse() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(true);
        when(q.getAuteurId()).thenReturn(auteur);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() -> service.signaler(CibleCommunaute.QUESTION, questionId, auteur, null))
                .isInstanceOf(AccesCommunauteRefuseException.class);
        verify(signalements, never()).save(any());
    }

    @Test
    void signaler_en_rafale_est_freine() {
        UUID questionId = UUID.randomUUID();
        UUID membre = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(true);
        when(q.getAuteurId()).thenReturn(UUID.randomUUID());
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(signalements.countBySignaleParAndCreatedAtAfter(eq(membre), any())).thenReturn(5L);

        assertThatThrownBy(() -> service.signaler(CibleCommunaute.QUESTION, questionId, membre, null))
                .isInstanceOf(TropDeMessagesException.class);
        verify(signalements, never()).save(any());
    }

    @Test
    void signaler_une_reponse_dont_la_question_est_masquee_est_introuvable() {
        UUID reponseId = UUID.randomUUID();
        UUID questionId = UUID.randomUUID();
        ReponseCommunaute r = mock(ReponseCommunaute.class);
        when(r.getId()).thenReturn(reponseId);
        when(r.getQuestionId()).thenReturn(questionId);
        when(r.estVisible()).thenReturn(true);
        when(r.getAuteurId()).thenReturn(UUID.randomUUID());
        when(reponses.findById(reponseId)).thenReturn(Optional.of(r));
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(false);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() -> service.signaler(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), null))
                .isInstanceOf(MessageCommunauteNotFoundException.class);
    }

    @Test
    void decider_rejeter_laisse_le_contenu_en_ligne_et_clot_les_signalements() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        SignalementCommunaute ouvert =
                new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), null, null);
        when(signalements.findByCibleTypeAndCibleIdAndStatut("question", questionId, "ouvert"))
                .thenReturn(List.of(ouvert));

        service.decider(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), DecisionModeration.ACTION_REJETER, null);

        verify(q, never()).masquer();
        verify(q, never()).supprimer();
        verify(q, never()).restaurer();
        assertThat(ouvert.getStatut()).isEqualTo(SignalementCommunaute.STATUT_TRAITE);
    }

    @Test
    void decider_restaurer_remet_en_ligne_un_contenu_masque() {
        UUID reponseId = UUID.randomUUID();
        ReponseCommunaute r = mock(ReponseCommunaute.class);
        when(r.getStatut()).thenReturn("masque");
        when(reponses.findById(reponseId)).thenReturn(Optional.of(r));

        service.decider(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_RESTAURER, null);

        verify(r).restaurer();
    }

    @Test
    void decider_restaurer_un_contenu_supprime_est_refuse() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getStatut()).thenReturn("supprime");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() -> service.decider(
                        CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), DecisionModeration.ACTION_RESTAURER, null))
                .isInstanceOf(MessageInvalideException.class);
        verify(q, never()).restaurer();
        verify(decisions, never()).save(any());
    }

    @Test
    void decider_masquer_un_contenu_supprime_est_refuse() {
        UUID questionId = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getStatut()).thenReturn("supprime");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));

        assertThatThrownBy(() -> service.decider(
                        CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), DecisionModeration.ACTION_MASQUER, null))
                .isInstanceOf(MessageInvalideException.class);
        verify(q, never()).masquer();
    }

    @Test
    void decider_revoquer_xp_laisse_les_signalements_ouverts() {
        UUID reponseId = UUID.randomUUID();
        reponseRetenue(reponseId, UUID.randomUUID());
        SignalementCommunaute ouvert =
                new SignalementCommunaute(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), null, null);
        when(signalements.findByCibleTypeAndCibleIdAndStatut("reponse", reponseId, "ouvert"))
                .thenReturn(List.of(ouvert));

        service.decider(CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_REVOQUER_XP, null);

        assertThat(ouvert.getStatut()).isEqualTo(SignalementCommunaute.STATUT_OUVERT);
    }

    @Test
    void decider_revoquer_xp_dune_reponse_non_retenue_est_refuse() {
        UUID reponseId = UUID.randomUUID();
        ReponseCommunaute r = mock(ReponseCommunaute.class);
        when(r.getId()).thenReturn(reponseId);
        when(reponses.findById(reponseId)).thenReturn(Optional.of(r));

        assertThatThrownBy(() -> service.decider(
                        CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_REVOQUER_XP, null))
                .isInstanceOf(MessageInvalideException.class);
        verify(evenements, never()).publishEvent(any());
    }

    @Test
    void decider_revoquer_xp_deux_fois_est_refuse() {
        UUID reponseId = UUID.randomUUID();
        reponseRetenue(reponseId, UUID.randomUUID());
        when(decisions.existsByCibleTypeAndCibleIdAndAction("reponse", reponseId, "revoquer_xp")).thenReturn(true);

        assertThatThrownBy(() -> service.decider(
                        CibleCommunaute.REPONSE, reponseId, UUID.randomUUID(), DecisionModeration.ACTION_REVOQUER_XP, null))
                .isInstanceOf(MessageInvalideException.class);
        verify(evenements, never()).publishEvent(any());
    }

    @Test
    void decider_sans_action_est_refuse() {
        assertThatThrownBy(() -> service.decider(
                        CibleCommunaute.QUESTION, UUID.randomUUID(), UUID.randomUUID(), null, null))
                .isInstanceOf(MessageInvalideException.class);
    }

    @Test
    void contester_un_contenu_en_ligne_est_refuse() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(auteur);
        when(q.estVisible()).thenReturn(true);
        when(q.getStatut()).thenReturn("publie");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        DecisionModeration decision = mock(DecisionModeration.class);
        when(decision.getId()).thenReturn(UUID.randomUUID());
        when(decisions.findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(any(), any(), any()))
                .thenReturn(Optional.of(decision));

        assertThatThrownBy(() -> service.contester(CibleCommunaute.QUESTION, questionId, auteur, "pourquoi ?"))
                .isInstanceOf(MessageInvalideException.class);
        verify(contestations, never()).save(any());
    }

    @Test
    void contester_avec_un_message_vide_ou_trop_long_est_refuse() {
        UUID questionId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getAuteurId()).thenReturn(auteur);
        when(q.getStatut()).thenReturn("masque");
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        DecisionModeration decision = mock(DecisionModeration.class);
        when(decision.getId()).thenReturn(UUID.randomUUID());
        when(decisions.findFirstByCibleTypeAndCibleIdAndActionInOrderByCreatedAtDesc(any(), any(), any()))
                .thenReturn(Optional.of(decision));

        assertThatThrownBy(() -> service.contester(CibleCommunaute.QUESTION, questionId, auteur, "   "))
                .isInstanceOf(MessageInvalideException.class);
        assertThatThrownBy(() -> service.contester(CibleCommunaute.QUESTION, questionId, auteur, "a".repeat(2_001)))
                .isInstanceOf(MessageInvalideException.class);
        verify(contestations, never()).save(any());
    }

    @Test
    void accepter_une_contestation_sur_un_contenu_supprime_ne_le_republie_pas() {
        UUID contestationId = UUID.randomUUID();
        UUID cibleId = UUID.randomUUID();
        ContestationModeration contestation = mock(ContestationModeration.class);
        when(contestation.estOuverte()).thenReturn(true);
        when(contestation.getCible()).thenReturn(CibleCommunaute.QUESTION);
        when(contestation.getCibleId()).thenReturn(cibleId);
        when(contestations.findById(contestationId)).thenReturn(Optional.of(contestation));
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getStatut()).thenReturn("supprime");
        when(questions.findById(cibleId)).thenReturn(Optional.of(q));

        service.trancherContestation(contestationId, UUID.randomUUID(), true, "désolé");

        verify(q, never()).restaurer();
        verify(decisions, never()).save(any());
        verify(contestation).trancher(eq(true), eq("désolé"), any(), any());
    }

    /** Une réponse visible, retenue comme utile par sa question visible. */
    private void reponseRetenue(UUID reponseId, UUID repondeur) {
        UUID questionId = UUID.randomUUID();
        ReponseCommunaute r = mock(ReponseCommunaute.class);
        when(r.getId()).thenReturn(reponseId);
        when(r.getQuestionId()).thenReturn(questionId);
        when(r.getAuteurId()).thenReturn(repondeur);
        when(r.estVisible()).thenReturn(true);
        when(reponses.findById(reponseId)).thenReturn(Optional.of(r));
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.getReponseResolueId()).thenReturn(reponseId);
        when(q.estVisible()).thenReturn(true);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
    }
}
