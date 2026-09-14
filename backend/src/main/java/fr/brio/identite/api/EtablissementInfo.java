package fr.brio.identite.api;

import java.time.LocalDate;
import java.util.UUID;

public record EtablissementInfo(
        UUID id,
        String nom,
        String uai,
        String type,
        LocalDate conventionSigneeLe,
        String conventionReference,
        boolean pathAActif
) {}
