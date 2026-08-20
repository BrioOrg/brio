package fr.brio.contenu.infrastructure;

public record ChapterResult(String slug, Status status, String message) {

    public enum Status { CREATED, UPDATED, SKIPPED, FAILED }
}
