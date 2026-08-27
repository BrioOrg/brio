package fr.brio.contenu.api;

public sealed interface Block permits TextBlock, ExerciseBlock {
    String id();
    String type();
}
