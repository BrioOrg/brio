package fr.brio.identite.domain;

/**
 * The legal guardian confirmed consent: they must receive the revocation link.
 * Internal to `identite`; same token caveat as {@link DemandeConsentementEmise}.
 */
public record ConsentementDonne(String destinataire, String lienRevocation) {}
