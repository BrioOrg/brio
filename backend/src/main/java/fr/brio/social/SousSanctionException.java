package fr.brio.social;

/** Levée quand un compte sous sanction de lecture seule tente d'écrire (ADR 0023). */
public class SousSanctionException extends RuntimeException {

    public SousSanctionException(String message) {
        super(message);
    }
}
