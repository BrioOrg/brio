package fr.brio.contenu.api;

import java.util.UUID;

public record ExerciseBlock(String id, String type, String prompt, UUID exerciceId) implements Block {}
