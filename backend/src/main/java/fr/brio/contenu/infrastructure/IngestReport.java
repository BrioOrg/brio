package fr.brio.contenu.infrastructure;

import java.util.List;

public record IngestReport(List<ChapterResult> results) {

    public boolean hasFailures() {
        return results.stream().anyMatch(r -> r.status() == ChapterResult.Status.FAILED);
    }

    public long countByStatus(ChapterResult.Status status) {
        return results.stream().filter(r -> r.status() == status).count();
    }
}
