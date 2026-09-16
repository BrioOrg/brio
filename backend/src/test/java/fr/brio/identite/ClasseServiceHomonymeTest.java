package fr.brio.identite;

import fr.brio.identite.api.InscriptionInfo;
import fr.brio.identite.domain.Inscription;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ClasseServiceHomonymeTest {

    @Test
    void shouldFlagBothStudentsWhenNomAfficheIsDuplicated() {
        UUID lea1 = UUID.randomUUID();
        UUID lea2 = UUID.randomUUID();
        List<Inscription> roster = List.of(
                inscription(lea1, "Léa"),
                inscription(lea2, "Léa"));

        List<InscriptionInfo> result = ClasseService.withHomonymeFlag(roster);

        assertThat(result).allMatch(InscriptionInfo::homonyme);
    }

    @Test
    void shouldNotFlagStudentsWithDistinctNomAffiche() {
        List<Inscription> roster = List.of(
                inscription(UUID.randomUUID(), "Léa B."),
                inscription(UUID.randomUUID(), "Léa D."));

        List<InscriptionInfo> result = ClasseService.withHomonymeFlag(roster);

        assertThat(result).noneMatch(InscriptionInfo::homonyme);
    }

    @Test
    void shouldOnlyFlagDuplicatesNotUniqueNames() {
        UUID lea1 = UUID.randomUUID();
        UUID lea2 = UUID.randomUUID();
        UUID tom  = UUID.randomUUID();
        List<Inscription> roster = List.of(
                inscription(lea1, "Léa"),
                inscription(lea2, "Léa"),
                inscription(tom,  "Tom"));

        List<InscriptionInfo> result = ClasseService.withHomonymeFlag(roster);

        assertThat(result).filteredOn(i -> i.compteId().equals(lea1) || i.compteId().equals(lea2))
                .allMatch(InscriptionInfo::homonyme);
        assertThat(result).filteredOn(i -> i.compteId().equals(tom))
                .noneMatch(InscriptionInfo::homonyme);
    }

    @Test
    void shouldReturnEmptyListForEmptyRoster() {
        assertThat(ClasseService.withHomonymeFlag(List.of())).isEmpty();
    }

    private static Inscription inscription(UUID compteId, String nomAffiche) {
        return Inscription.creer(UUID.randomUUID(), compteId, nomAffiche);
    }
}
