package fr.brio.exercices;

import java.util.UUID;

/** A teacher-course exercise submitted by a student the course is not scoped to (ADR 0050 §3). */
public class CoursHorsPorteeException extends RuntimeException {

    public CoursHorsPorteeException(UUID exerciceId) {
        super("Exercise not accessible to this student: " + exerciceId);
    }
}
