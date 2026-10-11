package vn.edu.qnu.st.nambede.auth.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.Comparator;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.RequestHeader;

/**
 * Swagger of this service alone: http://localhost:8081/swagger-ui.html. The gateway shows every service in one page,
 * calling them through /api: http://localhost:8000/docs. Every service names its scheme "bearerAuth", so a token
 * entered once in Swagger works for all of them.
 */
@Configuration
public class OpenApiConfig {

    static {
        // The Authorization header that controllers forward to other services is sent by the bearerAuth scheme
        SpringDocUtils.getConfig().addAnnotationsToIgnore(RequestHeader.class);
    }

    @Bean
    OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info().title("NamBeDe Auth Service").version("0.1.0")
                        .description("Tài khoản, đăng nhập, JWT, vai trò, gói FREE / VIP. Qua gateway: /api/auth, /api/users"))
                .components(new Components().addSecuritySchemes("bearerAuth", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")
                        .description("accessToken nhận được từ POST /api/auth/login")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }

    /** Log in first: the token from /auth/login is what every other call needs. */
    @Bean
    OpenApiCustomizer loginFirst() {
        return openApi -> {
            if (openApi.getTags() != null) {
                openApi.getTags().sort(Comparator.comparing(tag -> !"Đăng nhập".equals(tag.getName())));
            }
        };
    }
}
