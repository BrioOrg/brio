package fr.brio.devoirs;

/** Le binaire d'une copie + son type, pour la servir (usage interne, jamais sérialisé en JSON). */
public record ContenuPiece(byte[] contenu, String contentType, String filename) {}
