package fr.brio.identite.api;

import java.time.Instant;
import java.util.UUID;

/** Code metadata visible to teachers and admins. Raw code not included (stored hashed). */
public record CodeClasseInfo(
        UUID id,
        Instant expireAt,
        int usages,
        int usagesMax
) {}
