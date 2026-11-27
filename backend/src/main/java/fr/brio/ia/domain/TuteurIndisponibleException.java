package fr.brio.ia.domain;

public class TuteurIndisponibleException extends RuntimeException {
    public TuteurIndisponibleException() {
        super("Le tuteur est temporairement indisponible. Réessaie dans un moment.");
    }
}
