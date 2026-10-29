package fr.brio.identite.infrastructure;

/**
 * IP truncation for audit and rate limiting. A full IP from a minor's home connection is
 * personal data (ADR 0017 §5), so only a truncated form is ever stored or keyed on: the last
 * octet for IPv4, the last 64 bits for IPv6. Shared by the login audit log and the per-IP
 * rate limiter so both key on the exact same value.
 */
public final class AdresseIp {

    private AdresseIp() {}

    public static String tronquer(String ip) {
        if (ip == null) return null;
        if (ip.contains(":")) {
            // IPv6: zero the last 64 bits (last 4 groups in expanded form)
            String[] parts = ip.split(":", -1);
            if (parts.length == 8) {
                parts[4] = "0";
                parts[5] = "0";
                parts[6] = "0";
                parts[7] = "0";
                return String.join(":", parts);
            }
            return ip; // abbreviated form — store as-is rather than guess
        }
        // IPv4: remove last octet
        int last = ip.lastIndexOf('.');
        return last >= 0 ? ip.substring(0, last) + ".0" : ip;
    }
}
