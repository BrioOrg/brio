package fr.brio.ia.domain;

public class ChapitreNotFoundException extends RuntimeException {

    public ChapitreNotFoundException(String niveau, String matiere, String slug) {
        super("Chapitre introuvable : " + niveau + "/" + matiere + "/" + slug);
    }
}
