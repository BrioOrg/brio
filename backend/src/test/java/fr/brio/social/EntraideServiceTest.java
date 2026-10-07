package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionsQuery;
import fr.brio.social.api.ReponseUtileValidee;
import fr.brio.social.domain.Fil;
import fr.brio.social.domain.Message;
import fr.brio.social.domain.Signalement;
import fr.brio.social.infrastructure.FilRepository;
import fr.brio.social.infrastructure.MessageRepository;
import fr.brio.social.infrastructure.SanctionRepository;
import fr.brio.social.infrastructure.SignalementRepository;
import fr.brio.social.infrastructure.SoumissionVueRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;

class EntraideServiceTest {

    private FilRepository fils;
    private MessageRepository messages;
    private SignalementRepository signalements;
    private SanctionRepository sanctions;
    private SoumissionVueRepository soumissionsVues;
    private InscriptionsQuery inscriptions;
    private EnseignantContexteQuery enseignants;
    private ApplicationEventPublisher evenements;
    private EntraideService service;

    @BeforeEach
    void setUp() {
        fils = mock(FilRepository.class);
        messages = mock(MessageRepository.class);
        signalements = mock(SignalementRepository.class);
        sanctions = mock(SanctionRepository.class);
        soumissionsVues = mock(SoumissionVueRepository.class);
        inscriptions = mock(InscriptionsQuery.class);
        enseignants = mock(EnseignantContexteQuery.class);
        evenements = mock(ApplicationEventPublisher.class);
        service = new EntraideService(
                fils, messages, signalements, sanctions, soumissionsVues,
                inscriptions, enseignants, evenements);
    }

    // ---- marquer utile -----------------------------------------------------

    @Test
    void only_the_thread_author_can_mark_an_answer_useful() {
        UUID filId = UUID.randomUUID();
        UUID auteurFil = UUID.randomUUID();
        UUID autre = UUID.randomUUID();
        Fil fil = mock(Fil.class);
        when(fil.getAuteurId()).thenReturn(auteurFil);
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));

        assertThatThrownBy(() -> service.marquerUtile(filId, UUID.randomUUID(), autre))
                .isInstanceOf(AccesEntraideRefuseException.class);
        verify(evenements, never()).publishEvent(any());
    }

    @Test
    void marking_an_answer_useful_rewards_its_author_and_resolves_the_thread() {
        UUID filId = UUID.randomUUID();
        UUID auteurFil = UUID.randomUUID();
        UUID repondeur = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();

        Fil fil = mock(Fil.class);
        when(fil.getAuteurId()).thenReturn(auteurFil);
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));

        Message reponse = mock(Message.class);
        when(reponse.getFilId()).thenReturn(filId);
        when(reponse.getAuteurId()).thenReturn(repondeur);
        when(reponse.getId()).thenReturn(messageId);
        when(reponse.estUtile()).thenReturn(false);
        when(messages.findById(messageId)).thenReturn(java.util.Optional.of(reponse));

        service.marquerUtile(filId, messageId, auteurFil);

        verify(reponse).marquerUtile(any(), any());
        verify(fil).resoudre();
        ArgumentCaptor<ReponseUtileValidee> capt = ArgumentCaptor.forClass(ReponseUtileValidee.class);
        verify(evenements).publishEvent(capt.capture());
        assertThat(capt.getValue().repondeurId()).isEqualTo(repondeur);
        assertThat(capt.getValue().reponseId()).isEqualTo(messageId);
    }

    @Test
    void one_cannot_mark_ones_own_answer_useful() {
        UUID filId = UUID.randomUUID();
        UUID auteurFil = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();

        Fil fil = mock(Fil.class);
        when(fil.getAuteurId()).thenReturn(auteurFil);
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));

        Message sien = mock(Message.class);
        when(sien.getFilId()).thenReturn(filId);
        when(sien.getAuteurId()).thenReturn(auteurFil);
        when(messages.findById(messageId)).thenReturn(java.util.Optional.of(sien));

        assertThatThrownBy(() -> service.marquerUtile(filId, messageId, auteurFil))
                .isInstanceOf(MessageInvalideException.class);
        verify(evenements, never()).publishEvent(any());
    }

    // ---- garde anti-triche -------------------------------------------------

    @Test
    void an_exercise_thread_hides_other_answers_until_the_reader_has_submitted() {
        UUID classe = UUID.randomUUID();
        UUID exoId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        UUID lecteur = UUID.randomUUID();
        UUID filId = UUID.randomUUID();

        Fil fil = new Fil(Fil.PORTEE_EXERCICE, exoId.toString(), classe, "Je bloque sur le 3", auteur);
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));
        when(inscriptions.classesDeLEleve(lecteur)).thenReturn(Set.of(classe));
        when(enseignants.classesEnseignees(lecteur)).thenReturn(Set.of());
        when(soumissionsVues.existsByEleveIdAndExerciceId(lecteur, exoId)).thenReturn(false);
        when(inscriptions.elevesDeLaClasse(classe)).thenReturn(List.of());
        when(enseignants.nomsDesEnseignants(anySet())).thenReturn(Map.of());
        when(messages.findByFilIdOrderByCreatedAtAsc(filId)).thenReturn(List.of(
                new Message(filId, auteur, "la question"),
                new Message(filId, UUID.randomUUID(), "la réponse")));

        FilDetail detail = service.consulterFil(filId, lecteur);

        assertThat(detail.verrouille()).isTrue();
        assertThat(detail.messages()).isEmpty();
        assertThat(detail.reponsesMasquees()).isEqualTo(2);
    }

    @Test
    void an_exercise_thread_is_open_once_the_reader_has_submitted() {
        UUID classe = UUID.randomUUID();
        UUID exoId = UUID.randomUUID();
        UUID auteur = UUID.randomUUID();
        UUID lecteur = UUID.randomUUID();
        UUID filId = UUID.randomUUID();

        Fil fil = new Fil(Fil.PORTEE_EXERCICE, exoId.toString(), classe, "Je bloque sur le 3", auteur);
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));
        when(inscriptions.classesDeLEleve(lecteur)).thenReturn(Set.of(classe));
        when(enseignants.classesEnseignees(lecteur)).thenReturn(Set.of());
        when(soumissionsVues.existsByEleveIdAndExerciceId(lecteur, exoId)).thenReturn(true);
        when(inscriptions.elevesDeLaClasse(classe)).thenReturn(List.of());
        when(enseignants.nomsDesEnseignants(anySet())).thenReturn(Map.of());
        when(messages.findByFilIdOrderByCreatedAtAsc(filId)).thenReturn(List.of(
                new Message(filId, auteur, "la question"),
                new Message(filId, UUID.randomUUID(), "la réponse")));

        FilDetail detail = service.consulterFil(filId, lecteur);

        assertThat(detail.verrouille()).isFalse();
        assertThat(detail.messages()).hasSize(2);
    }

    // ---- modération préventive + appartenance ------------------------------

    @Test
    void a_non_member_cannot_answer() {
        UUID classe = UUID.randomUUID();
        UUID etranger = UUID.randomUUID();
        UUID filId = UUID.randomUUID();
        Fil fil = new Fil(Fil.PORTEE_CHAPITRE, "fractions", classe, "titre", UUID.randomUUID());
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));
        when(inscriptions.classesDeLEleve(etranger)).thenReturn(Set.of());
        when(enseignants.classesEnseignees(etranger)).thenReturn(Set.of());

        assertThatThrownBy(() -> service.repondre(filId, etranger, "bonjour"))
                .isInstanceOf(AccesEntraideRefuseException.class);
    }

    @Test
    void an_answer_with_an_external_link_is_rejected() {
        UUID classe = UUID.randomUUID();
        UUID membre = UUID.randomUUID();
        UUID filId = UUID.randomUUID();
        Fil fil = new Fil(Fil.PORTEE_CHAPITRE, "fractions", classe, "titre", UUID.randomUUID());
        when(fils.findById(filId)).thenReturn(java.util.Optional.of(fil));
        when(inscriptions.classesDeLEleve(membre)).thenReturn(Set.of(classe));
        when(sanctions.findByCompteIdAndType(any(), any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.repondre(filId, membre, "la correction est sur http://triche.fr"))
                .isInstanceOf(MessageInvalideException.class);
    }

    // ---- file de modération ------------------------------------------------

    @Test
    void the_moderation_queue_carries_the_class_a_sanction_applies_to() {
        UUID prof = UUID.randomUUID();
        UUID classeId = UUID.randomUUID();
        UUID autreClasse = UUID.randomUUID();
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of(classeId));

        Signalement chezMoi = signalementSur(messageDans(filDans(classeId)));
        Signalement ailleurs = signalementSur(messageDans(filDans(autreClasse)));
        when(signalements.findByStatutOrderByCreatedAtAsc(Signalement.STATUT_OUVERT))
                .thenReturn(List.of(chezMoi, ailleurs));

        List<SignalementVue> file = service.fileSignalements(prof);

        assertThat(file).singleElement().satisfies(v -> {
            assertThat(v.id()).isEqualTo(chezMoi.getId());
            assertThat(v.classeId()).isEqualTo(classeId);
        });
    }

    private Fil filDans(UUID classeId) {
        Fil fil = mock(Fil.class);
        UUID id = UUID.randomUUID();
        when(fil.getId()).thenReturn(id);
        when(fil.getClasseId()).thenReturn(classeId);
        when(fils.findById(id)).thenReturn(java.util.Optional.of(fil));
        return fil;
    }

    private Message messageDans(Fil fil) {
        Message message = mock(Message.class);
        UUID id = UUID.randomUUID();
        UUID filId = fil.getId();
        when(message.getId()).thenReturn(id);
        when(message.getFilId()).thenReturn(filId);
        when(message.getAuteurId()).thenReturn(UUID.randomUUID());
        when(message.getCorps()).thenReturn("un message");
        when(messages.findById(id)).thenReturn(java.util.Optional.of(message));
        return message;
    }

    private Signalement signalementSur(Message message) {
        Signalement s = mock(Signalement.class);
        UUID id = UUID.randomUUID();
        UUID messageId = message.getId();
        when(s.getId()).thenReturn(id);
        when(s.getMessageId()).thenReturn(messageId);
        return s;
    }
}
