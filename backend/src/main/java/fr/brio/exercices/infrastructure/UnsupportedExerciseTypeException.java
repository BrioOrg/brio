package fr.brio.exercices.infrastructure;

public class UnsupportedExerciseTypeException extends RuntimeException {
    public UnsupportedExerciseTypeException(String type) {
        super("No evaluator registered for exercise type: " + type);
    }
}
