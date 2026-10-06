package fr.brio.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Projection locale « cet élève a soumis cet exercice », alimentée en écoutant
 * {@code SoumissionEnregistree} d'{@code exercices} (ADR 0023). Sert la garde
 * anti-triche : dans un fil d'exercice, les réponses sont masquées aux élèves qui
 * n'ont pas encore soumis. Clé composite {@code (eleveId, exerciceId)} = idempotence.
 */
@Entity
@Table(name = "soumissions_vues", schema = "social")
@IdClass(SoumissionVue.Cle.class)
public class SoumissionVue {

    @Id
    @Column(name = "eleve_id", nullable = false)
    private UUID eleveId;

    @Id
    @Column(name = "exercice_id", nullable = false)
    private UUID exerciceId;

    @Column(name = "vue_at", nullable = false)
    private Instant vueAt = Instant.now();

    protected SoumissionVue() {}

    public SoumissionVue(UUID eleveId, UUID exerciceId) {
        this.eleveId = eleveId;
        this.exerciceId = exerciceId;
    }

    public UUID getEleveId() {
        return eleveId;
    }

    public UUID getExerciceId() {
        return exerciceId;
    }

    /** Clé composite JPA. */
    public static class Cle implements Serializable {
        private UUID eleveId;
        private UUID exerciceId;

        public Cle() {}

        public Cle(UUID eleveId, UUID exerciceId) {
            this.eleveId = eleveId;
            this.exerciceId = exerciceId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) {
                return true;
            }
            if (!(o instanceof Cle cle)) {
                return false;
            }
            return Objects.equals(eleveId, cle.eleveId) && Objects.equals(exerciceId, cle.exerciceId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(eleveId, exerciceId);
        }
    }
}
