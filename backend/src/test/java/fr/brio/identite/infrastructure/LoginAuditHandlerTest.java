package fr.brio.identite.infrastructure;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAuditHandlerTest {

    @Test
    void truncatesLastOctetForIPv4() {
        assertThat(LoginAuditHandler.truncateIp("192.168.1.42")).isEqualTo("192.168.1.0");
    }

    @Test
    void truncatesLastOctetEdgeCaseIPv4() {
        assertThat(LoginAuditHandler.truncateIp("10.0.0.1")).isEqualTo("10.0.0.0");
    }

    @Test
    void zeroesLast64BitsForExpandedIPv6() {
        String ip = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
        String result = LoginAuditHandler.truncateIp(ip);
        assertThat(result).endsWith(":0:0:0:0");
    }

    @Test
    void returnsNullForNullIp() {
        assertThat(LoginAuditHandler.truncateIp(null)).isNull();
    }

    @Test
    void hashesUserAgentAsSha256Hex() {
        String hash = LoginAuditHandler.hashUserAgent("Mozilla/5.0");
        assertThat(hash).hasSize(64).matches("[0-9a-f]+");
    }

    @Test
    void returnsNullForNullUserAgent() {
        assertThat(LoginAuditHandler.hashUserAgent(null)).isNull();
    }
}
