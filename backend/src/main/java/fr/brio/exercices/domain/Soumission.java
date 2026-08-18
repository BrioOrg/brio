package fr.brio.exercices.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "soumissions", schema = "exercices")
public class Soumission {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "exercice_id", nullable = false)
    private UUID exerciceId;

    @Column(name = "student_ref")
    private String studentRef;

    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String answer;

    @Column(nullable = false)
    private boolean correct;

    @Column(nullable = false, columnDefinition = "NUMERIC(5,4)")
    private double score;

    @Column(columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private String feedback;

    @Column(columnDefinition = "text[]")
    @JdbcTypeCode(SqlTypes.ARRAY)
    private List<String> competencies;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    protected Soumission() {}

    public Soumission(
            UUID exerciceId,
            String studentRef,
            String answer,
            boolean correct,
            double score,
            String feedback,
            List<String> competencies,
            Instant submittedAt) {
        this.exerciceId = exerciceId;
        this.studentRef = studentRef;
        this.answer = answer;
        this.correct = correct;
        this.score = score;
        this.feedback = feedback;
        this.competencies = competencies != null ? competencies : List.of();
        this.submittedAt = submittedAt;
    }

    public UUID getId() { return id; }
    public UUID getExerciceId() { return exerciceId; }
    public String getStudentRef() { return studentRef; }
    public String getAnswer() { return answer; }
    public boolean isCorrect() { return correct; }
    public double getScore() { return score; }
    public String getFeedback() { return feedback; }
    public List<String> getCompetencies() { return competencies; }
    public Instant getSubmittedAt() { return submittedAt; }
}
