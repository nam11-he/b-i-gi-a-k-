package vn.edu.qnu.st.nambede.auth.jwt;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** An RSA key pair that signs tokens, stored Base64-encoded. See V3__signing_keys_and_token_version.sql. */
@Entity
@Table(name = "signing_keys")
public class SigningKey {

    @Id
    private String kid;

    @Column(name = "private_key", nullable = false, updatable = false)
    private String privateKey;

    @Column(name = "public_key", nullable = false, updatable = false)
    private String publicKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected SigningKey() {
        // required by JPA
    }

    public SigningKey(String kid, String privateKey, String publicKey, Instant createdAt) {
        this.kid = kid;
        this.privateKey = privateKey;
        this.publicKey = publicKey;
        this.createdAt = createdAt;
    }

    public String getKid() {
        return kid;
    }

    public String getPrivateKey() {
        return privateKey;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
