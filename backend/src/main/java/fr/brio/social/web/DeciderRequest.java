package fr.brio.social.web;

import jakarta.validation.constraints.NotBlank;

/** Corps d'une décision de modération : l'action (masquer/supprimer/rejeter/restaurer/revoquer_xp) et un motif. */
record DeciderRequest(@NotBlank String action, String motif) {}
