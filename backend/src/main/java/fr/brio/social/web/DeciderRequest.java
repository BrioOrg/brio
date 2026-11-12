package fr.brio.social.web;

/** Corps d'une décision de modération : l'action (masquer/supprimer/rejeter/restaurer/revoquer_xp) et un motif. */
record DeciderRequest(String action, String motif) {}
