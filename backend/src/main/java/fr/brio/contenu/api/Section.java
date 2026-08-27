package fr.brio.contenu.api;

import java.util.List;

public record Section(String id, List<Block> blocks) {}
