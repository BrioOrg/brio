package fr.brio.social.web;

import jakarta.validation.constraints.NotBlank;

/** Corps d'une réponse dans un fil. */
record RepondreRequest(@NotBlank String corps) {}
