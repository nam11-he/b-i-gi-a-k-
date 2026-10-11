package vn.edu.qnu.st.nambede.auth.jwt;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** JWT settings bound from {@code app.jwt.*} in application.yml. */
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        @DefaultValue("nambede-auth") String issuer,
        @DefaultValue("1440") long expirationMinutes) {
}
