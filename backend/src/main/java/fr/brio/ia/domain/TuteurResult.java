package fr.brio.ia.domain;

import java.util.List;

/** The validated tutor response returned to callers. Citations are server-validated (Gate 2). */
public record TuteurResult(String reponse, List<String> citations) {}
