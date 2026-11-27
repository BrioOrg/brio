package fr.brio.exercices.rediges;

import java.util.List;
import java.util.Optional;

public interface RetourExerciceApi {
    int MAX_ENONCE = 1500;
    int MAX_REPONSE = 1200;

    boolean actif();

    Optional<Evaluation> evaluer(Demande demande);

    record Critere(String attendu, List<String> variantes) {}

    record Demande(String enonce, int minimum, List<Critere> criteres, String extraitLecon, String reponse) {}

    enum Etat { present, manquant, incertain }

    record Verdict(int critere, Etat etat, String extrait) {}

    record Evaluation(List<Verdict> verdicts, int tokensEntree, int tokensSortie) {}
}
