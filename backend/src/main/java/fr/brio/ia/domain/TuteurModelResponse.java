package fr.brio.ia.domain;

import java.util.List;

public record TuteurModelResponse(boolean repondable, String reponse, List<String> citations) {}
