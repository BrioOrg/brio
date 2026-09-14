package fr.brio.identite.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreerEtablissementRequest(
        @NotBlank @Size(max = 200) String nom,
        @Size(max = 8) String uai,
        @NotBlank @Pattern(regexp = "college|lycee") String type,
        LocalDate conventionSigneeLe,
        @Size(max = 200) String conventionReference
) {}
