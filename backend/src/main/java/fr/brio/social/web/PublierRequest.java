package fr.brio.social.web;

import jakarta.validation.constraints.NotBlank;

/** Corps d'un message publié dans un salon. */
record PublierRequest(@NotBlank String corps) {}
