package fr.brio.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.api.InscriptionsQuery;
import fr.brio.social.domain.Salon;
import fr.brio.social.domain.SalonMessage;
import fr.brio.social.domain.SalonSignalement;
import fr.brio.social.domain.Sanction;
import fr.brio.social.infrastructure.SalonMessageRepository;
import fr.brio.social.infrastructure.SalonRepository;
import fr.brio.social.infrastructure.SalonSignalementRepository;
import fr.brio.social.infrastructure.SanctionRepository;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MessagerieServiceTest {

    private SalonRepository salons;
    private SalonMessageRepository messages;
    private SalonSignalementRepository signalements;
    private SanctionRepository sanctions;
    private InscriptionsQuery inscriptions;
    private EnseignantContexteQuery enseignants;
    private MessagerieService service;

    @BeforeEach
    void setUp() {
        salons = mock(SalonRepository.class);
        messages = mock(SalonMessageRepository.class);
        signalements = mock(SalonSignalementRepository.class);
        sanctions = mock(SanctionRepository.class);
        inscriptions = mock(InscriptionsQuery.class);
        enseignants = mock(EnseignantContexteQuery.class);
        service = new MessagerieService(
                salons, messages, signalements, sanctions, inscriptions, enseignants);
    }

    // ---- créer un salon ----------------------------------------------------

    @Test
    void only_a_teacher_of_the_class_can_create_a_salon() {
        UUID prof = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of());

        assertThatThrownBy(() -> service.creerSalon(prof, new NouveauSalon(classe, "Questions")))
                .isInstanceOf(AccesMessagerieRefuseException.class);
    }

    @Test
    void a_teacher_creates_a_salon_for_their_class() {
        UUID prof = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID salonId = UUID.randomUUID();
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of(classe));
        Salon saved = mock(Salon.class);
        when(saved.getId()).thenReturn(salonId);
        when(salons.save(any())).thenReturn(saved);

        assertThat(service.creerSalon(prof, new NouveauSalon(classe, "Questions"))).isEqualTo(salonId);
    }

    // ---- publier -----------------------------------------------------------

    @Test
    void a_non_member_cannot_post() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID etranger = UUID.randomUUID();
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", UUID.randomUUID())));
        when(inscriptions.classesDeLEleve(etranger)).thenReturn(Set.of());
        when(enseignants.classesEnseignees(etranger)).thenReturn(Set.of());

        assertThatThrownBy(() -> service.publier(salonId, etranger, "bonjour"))
                .isInstanceOf(AccesMessagerieRefuseException.class);
    }

    @Test
    void a_muted_member_cannot_post() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID eleve = UUID.randomUUID();
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", UUID.randomUUID())));
        when(inscriptions.classesDeLEleve(eleve)).thenReturn(Set.of(classe));
        Sanction muet = mock(Sanction.class);
        when(muet.interditEcriture(any())).thenReturn(true);
        when(sanctions.findByCompteIdAndType(eleve, Sanction.TYPE_LECTURE_SEULE)).thenReturn(List.of(muet));

        assertThatThrownBy(() -> service.publier(salonId, eleve, "bonjour"))
                .isInstanceOf(SousSanctionException.class);
    }

    @Test
    void a_message_with_a_link_is_rejected() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID eleve = UUID.randomUUID();
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", UUID.randomUUID())));
        when(inscriptions.classesDeLEleve(eleve)).thenReturn(Set.of(classe));
        when(sanctions.findByCompteIdAndType(any(), any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.publier(salonId, eleve, "regarde http://triche.fr"))
                .isInstanceOf(MessageInvalideException.class);
    }

    // ---- lecture : visibilité ----------------------------------------------

    @Test
    void a_student_does_not_see_masked_messages_but_the_teacher_does() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID eleve = UUID.randomUUID();
        UUID prof = UUID.randomUUID();
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", prof)));
        when(inscriptions.elevesDeLaClasse(classe)).thenReturn(List.of());
        when(enseignants.nomsDesEnseignants(anySet())).thenReturn(Map.of());

        SalonMessage visible = new SalonMessage(salonId, eleve, "une question");
        SalonMessage masque = new SalonMessage(salonId, eleve, "un écart");
        masque.masquer();
        when(messages.findBySalonIdOrderByCreatedAtAsc(salonId)).thenReturn(List.of(visible, masque));

        // élève membre, pas enseignant
        when(inscriptions.classesDeLEleve(eleve)).thenReturn(Set.of(classe));
        when(enseignants.classesEnseignees(eleve)).thenReturn(Set.of());
        assertThat(service.messagesDuSalon(salonId, eleve)).hasSize(1);

        // enseignant de la classe : voit le masqué aussi
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of(classe));
        assertThat(service.messagesDuSalon(salonId, prof)).hasSize(2);
    }

    // ---- modération --------------------------------------------------------

    @Test
    void masking_requires_being_the_class_teacher() {
        UUID messageId = UUID.randomUUID();
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID autre = UUID.randomUUID();
        SalonMessage message = mock(SalonMessage.class);
        when(message.getSalonId()).thenReturn(salonId);
        when(messages.verrouiller(messageId)).thenReturn(Optional.of(message));
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", UUID.randomUUID())));
        when(enseignants.classesEnseignees(autre)).thenReturn(Set.of());

        assertThatThrownBy(() -> service.masquer(autre, messageId))
                .isInstanceOf(PasModerateurException.class);
        verify(message, org.mockito.Mockito.never()).masquer();
    }

    @Test
    void a_teacher_cannot_mask_their_own_message_nor_close_its_reports() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID prof = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        SalonMessage message = new SalonMessage(salonId, prof, "message du prof");
        when(messages.verrouiller(messageId)).thenReturn(Optional.of(message));
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", prof)));
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of(classe));

        assertThatThrownBy(() -> service.masquer(prof, messageId))
                .isInstanceOf(PasModerateurException.class);
        assertThat(message.estVisible()).isTrue();
        verify(signalements, org.mockito.Mockito.never()).findByMessageIdAndStatut(any(), any());
    }

    @Test
    void masking_closes_the_open_reports_of_that_message() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID prof = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        SalonMessage message = new SalonMessage(salonId, UUID.randomUUID(), "un écart");
        SalonSignalement ouvert = new SalonSignalement(messageId, UUID.randomUUID(), null);
        when(messages.verrouiller(messageId)).thenReturn(Optional.of(message));
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", prof)));
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of(classe));
        when(signalements.findByMessageIdAndStatut(messageId, SalonSignalement.STATUT_OUVERT))
                .thenReturn(List.of(ouvert));

        service.masquer(prof, messageId);

        assertThat(message.estVisible()).isFalse();
        assertThat(ouvert.getStatut()).isEqualTo(SalonSignalement.STATUT_TRAITE);
    }

    @Test
    void reporting_a_message_already_masked_records_nothing() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID eleve = UUID.randomUUID();
        UUID messageId = UUID.randomUUID();
        SalonMessage message = new SalonMessage(salonId, UUID.randomUUID(), "un écart");
        message.masquer();
        when(messages.verrouiller(messageId)).thenReturn(Optional.of(message));
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", UUID.randomUUID())));
        when(inscriptions.classesDeLEleve(eleve)).thenReturn(Set.of(classe));

        service.signaler(messageId, eleve, "pas gentil");

        verify(signalements, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void the_report_queue_leaves_out_the_teachers_own_messages_and_masked_ones() {
        UUID salonId = UUID.randomUUID();
        UUID classe = UUID.randomUUID();
        UUID prof = UUID.randomUUID();
        UUID eleve = UUID.randomUUID();
        SalonMessage duProf = mock(SalonMessage.class);
        when(duProf.getAuteurId()).thenReturn(prof);
        when(duProf.estVisible()).thenReturn(true);
        when(duProf.getSalonId()).thenReturn(salonId);
        SalonMessage masque = mock(SalonMessage.class);
        when(masque.getAuteurId()).thenReturn(eleve);
        when(masque.estVisible()).thenReturn(false);
        when(masque.getSalonId()).thenReturn(salonId);
        SalonMessage dUnEleve = mock(SalonMessage.class);
        UUID idEleve = UUID.randomUUID();
        when(dUnEleve.getId()).thenReturn(idEleve);
        when(dUnEleve.getAuteurId()).thenReturn(eleve);
        when(dUnEleve.estVisible()).thenReturn(true);
        when(dUnEleve.getSalonId()).thenReturn(salonId);
        when(dUnEleve.getCorps()).thenReturn("un écart");
        UUID idProf = UUID.randomUUID();
        UUID idMasque = UUID.randomUUID();
        when(messages.findById(idProf)).thenReturn(Optional.of(duProf));
        when(messages.findById(idMasque)).thenReturn(Optional.of(masque));
        when(messages.findById(idEleve)).thenReturn(Optional.of(dUnEleve));
        when(enseignants.classesEnseignees(prof)).thenReturn(Set.of(classe));
        when(salons.findById(salonId)).thenReturn(Optional.of(new Salon(classe, "Salon", prof)));
        when(inscriptions.elevesDeLaClasse(classe)).thenReturn(List.of());
        when(enseignants.nomsDesEnseignants(anySet())).thenReturn(Map.of());
        when(signalements.findByStatutOrderByCreatedAtAsc(SalonSignalement.STATUT_OUVERT))
                .thenReturn(List.of(
                        new SalonSignalement(idProf, eleve, null),
                        new SalonSignalement(idMasque, eleve, null),
                        new SalonSignalement(idEleve, UUID.randomUUID(), null)));

        assertThat(service.fileSignalements(prof))
                .extracting(SalonSignalementVue::messageId)
                .containsExactly(idEleve);
    }
}
