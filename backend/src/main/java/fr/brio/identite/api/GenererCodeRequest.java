package fr.brio.identite.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record GenererCodeRequest(
        /** TTL in days; defaults to 14 in the service, hard cap 60. */
        @Min(1) @Max(60) Integer expireDansJours,
        /** Max enrolments; defaults to 40. */
        @Min(1) @Max(200) Integer usagesMax
) {}
