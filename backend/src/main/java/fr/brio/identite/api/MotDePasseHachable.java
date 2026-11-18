package fr.brio.identite.api;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.nio.charset.StandardCharsets;

/**
 * A password bcrypt can hash: at most {@link #MAX_OCTETS} BYTES of UTF-8, not characters (#364,
 * #368). An accented letter takes two, an emoji four; beyond the limit the encoder throws, which
 * surfaced as a 500. Checked on every request that hashes a typed password, so the refusal is a
 * 400 with a message saying what to change. {@code null} is valid: {@code @NotBlank} says so.
 */
@Documented
@Constraint(validatedBy = MotDePasseHachable.Validateur.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface MotDePasseHachable {

    /** Longest password bcrypt can hash, in bytes of UTF-8. */
    int MAX_OCTETS = 72;

    /** The student's wording; a teacher's request overrides it with the formal one. */
    String MESSAGE_TU = "Ton mot de passe est trop long. Raccourcis-le : "
            + "les lettres accentuées et les emojis comptent pour plusieurs caractères.";
    String MESSAGE_VOUS = "Votre mot de passe est trop long. Raccourcissez-le : "
            + "les lettres accentuées et les emojis comptent pour plusieurs caractères.";

    String message() default MESSAGE_TU;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    /** Counts the bytes bcrypt will see, without hashing anything. */
    final class Validateur implements ConstraintValidator<MotDePasseHachable, CharSequence> {
        @Override
        public boolean isValid(CharSequence motDePasse, ConstraintValidatorContext context) {
            if (motDePasse == null) return true;
            // Every char is at least one byte: a longer string is refused without encoding it.
            return motDePasse.length() <= MAX_OCTETS
                    && motDePasse.toString().getBytes(StandardCharsets.UTF_8).length <= MAX_OCTETS;
        }
    }
}
