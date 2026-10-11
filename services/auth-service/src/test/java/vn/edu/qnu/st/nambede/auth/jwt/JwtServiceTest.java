package vn.edu.qnu.st.nambede.auth.jwt;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import vn.edu.qnu.st.nambede.auth.security.AuthUser;
import vn.edu.qnu.st.nambede.auth.user.Role;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService(new JwtProperties("nambede-auth", 60), TestKeys.KEYS);

    @Test
    void issuedTokenIsVerified() {
        String token = jwtService.issue(7L, "student@nambede.local", "Nguyen Van A", Role.STUDENT, 3);

        AuthUser user = jwtService.verify(token);

        assertThat(user.id()).isEqualTo(7L);
        assertThat(user.email()).isEqualTo("student@nambede.local");
        assertThat(user.role()).isEqualTo("STUDENT");
        assertThat(jwtService.session(token)).isEqualTo(new JwtService.Session(7L, 3));
    }

    @Test
    void tokensAreSignedWithRs256AndNameTheirKey() {
        String token = jwtService.issue(7L, "student@nambede.local", "Nguyen Van A", Role.STUDENT, 0);

        String header = new String(Base64.getUrlDecoder().decode(token.substring(0, token.indexOf('.'))), StandardCharsets.UTF_8);
        assertThat(header).contains("\"alg\":\"RS256\"").contains("\"kid\":\"" + TestKeys.KEYS.signingKid() + "\"");
    }

    @Test
    void tokenSignedWithAnotherKeyIsRejected() {
        JwtService other = new JwtService(new JwtProperties("nambede-auth", 60), JwtKeys.generate());
        String token = other.issue(7L, "student@nambede.local", "Nguyen Van A", Role.ADMIN, 0);

        assertThatThrownBy(() -> jwtService.verify(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void anHs256TokenMadeWithThePublicKeyIsRejected() {
        // The classic algorithm confusion: sign with HMAC using the public key as the secret, and name our key
        byte[] publicKey = TestKeys.KEYS.publicKey(TestKeys.KEYS.signingKid()).getEncoded();
        String forged = Jwts.builder().header().keyId(TestKeys.KEYS.signingKid()).and()
                .issuer("nambede-auth").subject("1").claim("role", "ADMIN")
                .expiration(Date.from(Instant.now().plusSeconds(300)))
                .signWith(Keys.hmacShaKeyFor(publicKey), Jwts.SIG.HS256)
                .compact();

        assertThatThrownBy(() -> jwtService.verify(forged)).isInstanceOf(JwtException.class);
    }

    @Test
    void expiredTokenIsRejected() {
        JwtService expired = new JwtService(new JwtProperties("nambede-auth", -1), TestKeys.KEYS);
        String token = expired.issue(7L, "student@nambede.local", "Nguyen Van A", Role.STUDENT, 0);

        assertThatThrownBy(() -> jwtService.verify(token)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    @SuppressWarnings("unchecked")
    void theJwkSetPublishesThePublicKeyOnly() {
        Map<String, Object> jwks = TestKeys.KEYS.jwks();

        List<Map<String, String>> keys = (List<Map<String, String>>) jwks.get("keys");
        assertThat(keys).hasSize(1);
        Map<String, String> key = keys.get(0);
        assertThat(key).containsEntry("kty", "RSA").containsEntry("alg", "RS256").containsEntry("use", "sig")
                .containsEntry("kid", TestKeys.KEYS.signingKid())
                .containsOnlyKeys("kty", "alg", "use", "kid", "n", "e");
        // n and e are the public key's numbers, Base64url without the sign byte
        RSAPublicKey publicKey = (RSAPublicKey) TestKeys.KEYS.publicKey(TestKeys.KEYS.signingKid());
        assertThat(new BigInteger(1, Base64.getUrlDecoder().decode(key.get("n")))).isEqualTo(publicKey.getModulus());
        assertThat(key.get("e")).isEqualTo("AQAB");
    }

    @Test
    void storedKeysSignTheSameTokensAfterARestart() {
        JwtKeys reloaded = JwtKeys.from(List.of(TestKeys.KEYS.toEntity()));
        String token = new JwtService(new JwtProperties("nambede-auth", 60), reloaded)
                .issue(7L, "student@nambede.local", "Nguyen Van A", Role.STUDENT, 0);

        assertThat(reloaded.signingKid()).isEqualTo(TestKeys.KEYS.signingKid());
        assertThat(jwtService.verify(token).id()).isEqualTo(7L);
    }
}
