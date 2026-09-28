package fr.brio.identite.domain;

/**
 * A parental consent request was recorded: the legal guardian must receive the
 * confirmation link. Internal to `identite` — published so the e-mail leaves only
 * once the request is committed (never for a rolled-back signup).
 *
 * The link carries the plaintext token, which the database otherwise only stores
 * hashed; completed publications are therefore deleted from `event_publication`
 * (`spring.modulith.events.completion-mode=delete`).
 */
public record DemandeConsentementEmise(String destinataire, String lienConfirmation) {}
