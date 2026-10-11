-- Phase 12: tokens are signed with RS256. auth-service keeps its RSA key pair here and is the only service that can
-- sign; the others verify with the public key from GET /.well-known/jwks.json. A key is made on the first start.
CREATE TABLE signing_keys (
    kid         VARCHAR(64) PRIMARY KEY,
    private_key TEXT        NOT NULL, -- PKCS#8, Base64
    public_key  TEXT        NOT NULL, -- X.509, Base64
    created_at  TIMESTAMPTZ NOT NULL
);

-- Raised when a user's sessions must end (account locked, role changed). Each token carries the version it was
-- issued with ("ver"); the gateway asks GET /auth/session whether it is still the current one.
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
