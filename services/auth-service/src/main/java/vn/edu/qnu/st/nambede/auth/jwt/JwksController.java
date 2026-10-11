package vn.edu.qnu.st.nambede.auth.jwt;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public keys that verify the tokens, for the gateway and the other services. No secret is ever shared. */
@Tag(name = "Khóa công khai", description = "JWK Set: các service khác lấy khóa công khai ở đây để kiểm tra chữ ký của token")
@RestController
public class JwksController {

    private final JwtKeys keys;

    public JwksController(JwtKeys keys) {
        this.keys = keys;
    }

    @Operation(summary = "Khóa công khai RS256 (JWK Set), công khai, không cần token")
    @SecurityRequirements
    @GetMapping("/.well-known/jwks.json")
    public ResponseEntity<Map<String, Object>> jwks() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic()).body(keys.jwks());
    }
}
