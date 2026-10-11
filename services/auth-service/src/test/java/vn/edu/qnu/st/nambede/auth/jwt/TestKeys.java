package vn.edu.qnu.st.nambede.auth.jwt;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

/** One RSA key pair for the tests, in place of the one auth-service keeps in auth_db. */
@TestConfiguration
public class TestKeys {

    public static final JwtKeys KEYS = JwtKeys.generate();

    @Bean
    JwtKeys jwtKeys() {
        return KEYS;
    }
}
