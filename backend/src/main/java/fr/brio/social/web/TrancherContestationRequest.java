package fr.brio.social.web;

/** Corps du traitement d'une contestation : accepter (restaurer) ou non, avec une réponse au membre. */
record TrancherContestationRequest(boolean accepter, String reponse) {}
