package fr.brio.social;

import java.util.List;

/** Une page de la liste des questions. */
public record PageQuestionsCommunaute(List<QuestionCommunauteResume> questions, boolean pageSuivante) {}
