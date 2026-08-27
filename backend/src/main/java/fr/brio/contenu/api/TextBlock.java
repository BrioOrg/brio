package fr.brio.contenu.api;

public record TextBlock(String id, String type, String text) implements Block {}
