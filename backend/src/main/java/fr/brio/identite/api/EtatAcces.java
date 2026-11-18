package fr.brio.identite.api;

/**
 * What an authenticated session may do right now, re-read on every request
 * ({@code system.web.StatutCheckFilter}).
 */
public enum EtatAcces {
    /** Active account: the session may do anything its role allows. */
    ACTIF,
    /** Active account after a teacher-led reset: only choosing a new password (ADR 0036 §5). */
    MOT_DE_PASSE_A_CHANGER,
    /** Unknown, pending, suspended or closed account: the session is refused. */
    INACTIF
}
