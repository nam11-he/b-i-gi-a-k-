package vn.edu.qnu.st.nambede.auth.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwsHeader;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.UnsupportedJwtException;
import java.security.Key;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import org.springframework.stereotype.Component;
import vn.edu.qnu.st.nambede.auth.security.AuthUser;
import vn.edu.qnu.st.nambede.auth.user.Role;

/**
 * Issues and verifies RS256 tokens. Only this service holds a private key; the gateway and the other services verify
 * with the public keys of GET /.well-known/jwks.json, so a leak there cannot be used to make an admin token.
 * Each token carries the user's token version ("ver") so that locking an account or changing a role ends it.
 */
@Component
public class JwtService {

    private final JwtProperties properties;
    private final JwtKeys keys;

    public JwtService(JwtProperties properties, JwtKeys keys) {
        this.properties = properties;
        this.keys = keys;
    }

    /** The parts of a verified token that GET /auth/session compares with the user as stored now. */
    public record Session(Long userId, int tokenVersion) {
    }

    public String issue(Long userId, String email, String fullName, Role role, int tokenVersion) {
        Instant now = Instant.now();
        return Jwts.builder()
                .header().keyId(keys.signingKid()).and()
                .issuer(properties.issuer())
                // "sub" must be a string: PyJWT (gateway, learning-service) rejects a numeric subject
                .subject(String.valueOf(userId))
                .claim("email", email)
                .claim("name", fullName)
                .claim("role", role.name())
                .claim("ver", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(Duration.ofMinutes(properties.expirationMinutes()))))
                .signWith(keys.signingKey(), Jwts.SIG.RS256)
                .compact();
    }

    /**
     * Returns the caller described by the token.
     *
     * @throws io.jsonwebtoken.JwtException if the token is malformed, expired or not signed by one of our keys
     */
    public AuthUser verify(String token) {
        Claims claims = claims(token);
        return new AuthUser(Long.valueOf(claims.getSubject()), claims.get("email", String.class),
                claims.get("role", String.class));
    }

    /** User id and token version of a valid token. */
    public Session session(String token) {
        Claims claims = claims(token);
        Integer version = claims.get("ver", Integer.class);
        return new Session(Long.valueOf(claims.getSubject()), version == null ? 0 : version);
    }

    private Claims claims(String token) {
        Claims claims = Jwts.parser()
                .keyLocator(new LocatorAdapter<Key>() {
                    @Override
                    protected Key locate(JwsHeader header) {
                        Key key = keys.publicKey(header.getKeyId());
                        if (key == null) {
                            throw new UnsupportedJwtException("Token signed with an unknown key");
                        }
                        return key;
                    }
                })
                .requireIssuer(properties.issuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        if (claims.getSubject() == null || claims.get("role", String.class) == null) {
            throw new MalformedJwtException("Token is missing the sub or role claim");
        }
        return claims;
    }

    public long expiresInSeconds() {
        return properties.expirationMinutes() * 60;
    }
}
