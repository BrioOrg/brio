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
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(signalements.existsByCibleTypeAndCibleIdAndSignalePar("question", questionId, membre))
                .thenReturn(false);

        service.signaler(CibleCommunaute.QUESTION, questionId, membre, "spam");

        ArgumentCaptor<SignalementCommunaute> captor = ArgumentCaptor.forClass(SignalementCommunaute.class);
        verify(signalements).save(captor.capture());
        assertThat(captor.getValue().getCible()).isEqualTo(CibleCommunaute.QUESTION);
        assertThat(captor.getValue().getMotif()).isEqualTo("spam");
    }

    @Test
    void signaler_est_idempotent_par_membre() {
        UUID questionId = UUID.randomUUID();
        UUID membre = UUID.randomUUID();
        QuestionCommunaute q = mock(QuestionCommunaute.class);
        when(q.estVisible()).thenReturn(true);
        when(questions.findById(questionId)).thenReturn(Optional.of(q));
        when(signalements.existsByCibleTypeAndCibleIdAndSignalePar("question", questionId, membre))
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
                new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), null);
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
        ReponseCommunaute r = mock(ReponseCommunaute.class);
        when(r.getAuteurId()).thenReturn(repondeur);
        when(reponses.findById(reponseId)).thenReturn(Optional.of(r));

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
        SignalementCommunaute s1 = new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), "spam");
        SignalementCommunaute s2 = new SignalementCommunaute(CibleCommunaute.QUESTION, questionId, UUID.randomUUID(), null);
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
    }
}
