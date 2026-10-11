package vn.edu.qnu.st.nambede.auth.jwt;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The RSA keys of auth-service. The newest private key signs tokens (RS256); every public key can verify, and all of
 * them are published as a JWK Set so the other services can check tokens without ever holding a signing key.
 */
public final class JwtKeys {

    private static final Base64.Encoder BASE64URL = Base64.getUrlEncoder().withoutPadding();

    private final String signingKid;
    private final PrivateKey signingKey;
    /** kid -> public key, newest first. */
    private final Map<String, RSAPublicKey> publicKeys;

    private JwtKeys(String signingKid, PrivateKey signingKey, Map<String, RSAPublicKey> publicKeys) {
        this.signingKid = signingKid;
        this.signingKey = signingKey;
        this.publicKeys = publicKeys;
    }

    /** A fresh 2048-bit RSA key pair (first start, tests). */
    public static JwtKeys generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair pair = generator.generateKeyPair();
            RSAPublicKey publicKey = (RSAPublicKey) pair.getPublic();
            String kid = kidOf(publicKey);
            return new JwtKeys(kid, pair.getPrivate(), Map.of(kid, publicKey));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Cannot generate an RSA key pair", ex);
        }
    }

    /** From the stored keys, newest first. */
    public static JwtKeys from(List<SigningKey> stored) {
        if (stored.isEmpty()) {
            throw new IllegalArgumentException("No signing key");
        }
        try {
            KeyFactory rsa = KeyFactory.getInstance("RSA");
            Map<String, RSAPublicKey> publicKeys = new LinkedHashMap<>();
            for (SigningKey key : stored) {
                publicKeys.put(key.getKid(), (RSAPublicKey) rsa.generatePublic(
                        new X509EncodedKeySpec(Base64.getDecoder().decode(key.getPublicKey()))));
            }
            SigningKey newest = stored.get(0);
            PrivateKey privateKey = rsa.generatePrivate(
                    new PKCS8EncodedKeySpec(Base64.getDecoder().decode(newest.getPrivateKey())));
            return new JwtKeys(newest.getKid(), privateKey, publicKeys);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("A stored signing key cannot be read", ex);
        }
    }

    /** The signing key as a row to store. */
    public SigningKey toEntity() {
        Base64.Encoder base64 = Base64.getEncoder();
        return new SigningKey(signingKid, base64.encodeToString(signingKey.getEncoded()),
                base64.encodeToString(publicKeys.get(signingKid).getEncoded()), Instant.now());
    }

    public String signingKid() {
        return signingKid;
    }

    public PrivateKey signingKey() {
        return signingKey;
    }

    /** The public key with this id, or null. */
    public PublicKey publicKey(String kid) {
        return kid == null ? null : publicKeys.get(kid);
    }

    /** The JWK Set (RFC 7517) served at /.well-known/jwks.json. */
    public Map<String, Object> jwks() {
        List<Map<String, String>> keys = publicKeys.entrySet().stream().map(entry -> Map.of(
                "kty", "RSA",
                "use", "sig",
                "alg", "RS256",
                "kid", entry.getKey(),
                "n", BASE64URL.encodeToString(unsigned(entry.getValue().getModulus())),
                "e", BASE64URL.encodeToString(unsigned(entry.getValue().getPublicExponent())))).toList();
        return Map.of("keys", keys);
    }

    /** Key id: the first 16 characters of the SHA-256 of the public key, Base64url. */
    static String kidOf(PublicKey publicKey) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(publicKey.getEncoded());
            return new String(BASE64URL.encode(digest), StandardCharsets.US_ASCII).substring(0, 16);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** JWK numbers are unsigned big-endian: drop the sign byte Java adds when the top bit is set. */
    private static byte[] unsigned(BigInteger value) {
        byte[] bytes = value.toByteArray();
        return bytes.length > 1 && bytes[0] == 0 ? Arrays.copyOfRange(bytes, 1, bytes.length) : bytes;
    }
}
