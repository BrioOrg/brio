package fr.brio.devoirs.web;

import java.math.BigDecimal;

/** Correction d'un rendu par l'enseignant : une note et/ou une appréciation (F5, ADR 0028). */
record CorrectionRequest(BigDecimal note, String appreciation) {}
