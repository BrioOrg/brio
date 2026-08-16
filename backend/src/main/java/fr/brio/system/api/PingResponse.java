package fr.brio.system.api;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record PingResponse(@NotNull String status, @NotNull String version, @NotNull Instant timestamp) {}
