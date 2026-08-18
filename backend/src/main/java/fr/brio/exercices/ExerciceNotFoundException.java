package fr.brio.exercices;

import java.util.UUID;

public class ExerciceNotFoundException extends RuntimeException {
    public ExerciceNotFoundException(UUID id) {
        super("Exercise not found: " + id);
    }
}
