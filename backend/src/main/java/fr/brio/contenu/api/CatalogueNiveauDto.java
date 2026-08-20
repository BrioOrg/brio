package fr.brio.contenu.api;

import java.util.List;

public record CatalogueNiveauDto(String niveauCode, String niveauLibelle, List<CatalogueMatiereDto> matieres) {}
