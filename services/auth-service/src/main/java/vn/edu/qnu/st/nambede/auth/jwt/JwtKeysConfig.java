package vn.edu.qnu.st.nambede.auth.jwt;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Loads the signing keys from auth_db, or makes and stores the first one, so there is nothing to configure. */
@Configuration
public class JwtKeysConfig {

    private static final Logger log = LoggerFactory.getLogger(JwtKeysConfig.class);

    @Bean
    JwtKeys jwtKeys(SigningKeyRepository repository) {
        List<SigningKey> stored = repository.findAllByOrderByCreatedAtDesc();
        if (!stored.isEmpty()) {
            return JwtKeys.from(stored);
        }
        JwtKeys keys = JwtKeys.generate();
        repository.save(keys.toEntity());
        log.info("Created the RSA key {} that signs tokens (kept in auth_db.signing_keys)", keys.signingKid());
        return keys;
    }
}
