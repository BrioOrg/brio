package fr.brio.ia.domain;

import java.util.UUID;

public class CoursNotFoundException extends RuntimeException {

    public CoursNotFoundException(UUID coursId) {
        super("Cours introuvable ou non publié : " + coursId);
    }
}
