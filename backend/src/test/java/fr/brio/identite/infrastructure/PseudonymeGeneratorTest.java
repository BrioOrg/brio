package fr.brio.identite.infrastructure;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PseudonymeGeneratorTest {

    private final CompteRepository comptes = mock(CompteRepository.class);
    private final PseudonymeGenerator generator = new PseudonymeGenerator(comptes);

    @Test
    void shouldOfferAboutFortyAnimalsAndTwentyColours() {
        assertThat(PseudonymeGenerator.ANIMAUX).hasSize(40).doesNotHaveDuplicates();
        assertThat(PseudonymeGenerator.COULEURS).hasSize(20).doesNotHaveDuplicates();
    }

    @Test
    void shouldFollowTheAnimalCouleurPatternWhenFree() {
        when(comptes.existsByPseudonyme(anyString())).thenReturn(false);

        String[] parts = generator.generateUnique().split("-");

        assertThat(parts).hasSize(2);
        assertThat(PseudonymeGenerator.ANIMAUX).contains(parts[0]);
        assertThat(PseudonymeGenerator.COULEURS).contains(parts[1]);
    }

    @Test
    void shouldAppendTheFirstFreeNumericSuffixOnCollision() {
        when(comptes.existsByPseudonyme(anyString()))
                .thenAnswer(call -> !((String) call.getArgument(0)).endsWith("-3"));

        assertThat(generator.generateUnique()).matches("[^-]+-[^-]+-3");
    }
}
