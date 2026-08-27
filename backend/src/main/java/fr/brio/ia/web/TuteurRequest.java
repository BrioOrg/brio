package fr.brio.ia.web;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

record TuteurRequest(
        @NotBlank String question,
        UUID exerciceId) {}
