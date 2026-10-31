package fr.brio.identite.api;

import java.util.UUID;

/**
 * A class as its member reads it (GET /api/moi/classes): {@link ClasseInfo} plus the name of the
 * school and, for a student, the name they go by in that class.
 */
public record ClasseDuCompte(
        UUID id,
        UUID etablissementId,
        String etablissementNom, // null if the school no longer exists
        String niveauCode,
        String libelle,
        String anneeScolaire,
        String statut,
        UUID enseignantPrincipalId, // null until a principal teacher is assigned
        String nomAffiche // null for a teacher, who has no enrolment in the class
) {}
