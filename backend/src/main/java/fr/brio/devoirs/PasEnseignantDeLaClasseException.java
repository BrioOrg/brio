package fr.brio.devoirs;

import java.util.UUID;

public class PasEnseignantDeLaClasseException extends RuntimeException {

    public PasEnseignantDeLaClasseException(UUID classeId) {
        super("Vous n'êtes pas l'enseignant de la classe " + classeId + ".");
    }
}
