package fr.brio.identite.domain;

import java.time.LocalDate;
import java.time.Month;

/** The school year a date falls in, as stored on a class: {@code 2026-2027}. */
public final class AnneeScolaire {

    private AnneeScolaire() {}

    /** A new year starts on 1 August: a class created over the summer is for the coming year. */
    public static String du(LocalDate date) {
        int debut = date.getMonthValue() >= Month.AUGUST.getValue() ? date.getYear() : date.getYear() - 1;
        return debut + "-" + (debut + 1);
    }
}
