package fr.brio.identite.api;

import java.time.Instant;
import java.util.UUID;

/** Returned exactly once at code generation time. Includes the raw code — not retrievable after. */
public record CodeClasseCreee(
        UUID id,
        String code,
        Instant expireAt,
        int usages,
        int usagesMax
) {}
