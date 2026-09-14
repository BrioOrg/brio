package fr.brio.identite.api;

import java.util.UUID;

public record ClasseInfo(
        UUID id,
        UUID etablissementId,
        String niveauCode,
        String libelle,
        String anneeScolaire,
        String statut
) {}
