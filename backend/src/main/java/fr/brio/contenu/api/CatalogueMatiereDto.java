package fr.brio.contenu.api;

import java.util.List;

public record CatalogueMatiereDto(String matiereCode, String matiereLibelle, List<CatalogueChapitreDto> chapitres) {}
