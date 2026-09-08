package fr.brio.system.web;

import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.web.DefaultSecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;

import java.util.List;

class BasicAuthGuardTest {

    @Test
    void refusesStartupWhenBasicAuthFilterPresent() {
        var filter = new BasicAuthenticationFilter(auth -> {
            throw new BadCredentialsException("no-op");
        });
        var chain = new DefaultSecurityFilterChain(AnyRequestMatcher.INSTANCE, filter);
        var guard = new BasicAuthGuard(List.of(chain));

        Assertions.assertThatThrownBy(guard::afterSingletonsInstantiated)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("HTTP Basic Auth");
    }

    @Test
    void allowsStartupWhenNoBasicAuthFilterPresent() {
        var chain = new DefaultSecurityFilterChain(AnyRequestMatcher.INSTANCE, List.of());
        var guard = new BasicAuthGuard(List.of(chain));

        Assertions.assertThatNoException().isThrownBy(guard::afterSingletonsInstantiated);
    }
}
