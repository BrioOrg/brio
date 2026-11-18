package fr.brio.social.web;

import jakarta.validation.constraints.NotNull;

/** Corps du traitement d'une contestation : accepter (restaurer) ou non, avec une réponse au membre. */
record TrancherContestationRequest(@NotNull Boolean accepter, String reponse) {}
