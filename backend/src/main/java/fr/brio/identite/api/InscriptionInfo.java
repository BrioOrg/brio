package fr.brio.identite.api;

import java.time.LocalDate;
import java.util.UUID;

public record InscriptionInfo(
        UUID compteId,
        String nomAffiche,
        LocalDate depuis,
        boolean homonyme
) {}
