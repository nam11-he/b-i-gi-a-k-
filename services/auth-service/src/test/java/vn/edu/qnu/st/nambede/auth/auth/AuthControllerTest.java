package vn.edu.qnu.st.nambede.auth.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.qnu.st.nambede.auth.auth.dto.LoginRequest;
import vn.edu.qnu.st.nambede.auth.auth.dto.RegisterRequest;
import vn.edu.qnu.st.nambede.auth.config.SecurityConfig;
import vn.edu.qnu.st.nambede.auth.common.ApiException;
import vn.edu.qnu.st.nambede.auth.jwt.JwksController;
import vn.edu.qnu.st.nambede.auth.jwt.JwtService;
import vn.edu.qnu.st.nambede.auth.jwt.TestKeys;

@WebMvcTest(controllers = {AuthController.class, JwksController.class})
@Import({SecurityConfig.class, JwtService.class, TestKeys.class})
class AuthControllerTest {

    /** 40 characters but 120 bytes in UTF-8: under the old 72-character limit, over what bcrypt accepts. */
    static final String LONG_VIETNAMESE_PASSWORD = "ệ".repeat(40);

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @Test
    void bcryptRefusesMoreThan72Bytes() {
        // Why the request has to be stopped before it reaches the encoder: otherwise the client gets a 500
        assertThatThrownBy(() -> new BCryptPasswordEncoder(4).encode(LONG_VIETNAMESE_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void registerWithPasswordOver72BytesReturns400() throws Exception {
        mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"sv@nambede.local\",\"fullName\":\"Sinh Viên\",\"password\":\""
                                + LONG_VIETNAMESE_PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password: must be at most 72 bytes; an accented letter takes 2 to 3 bytes"));

        verify(authService, never()).register(any(RegisterRequest.class));
    }

    @Test
    void tooManyFailedLoginsReturn429WithRetryAfter() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenThrow(new TooManyLoginsException(240));

        mockMvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"sv@nambede.local\",\"password\":\"Student@123\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "240"))
                .andExpect(jsonPath("$.status").value(429))
                .andExpect(jsonPath("$.message").value("Too many failed sign-ins, try again in 240 seconds"));
    }

    @Test
    void sessionAnswers204ForAGoodTokenAnd401WithTheReasonOtherwise() throws Exception {
        mockMvc.perform(get("/auth/session").header("Authorization", "Bearer good"))
                .andExpect(status().isNoContent());
        verify(authService).checkSession("good");

        org.mockito.Mockito.doThrow(new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Account is locked"))
                .when(authService).checkSession("locked");
        mockMvc.perform(get("/auth/session").header("Authorization", "Bearer locked"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Account is locked"));
        mockMvc.perform(get("/auth/session"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theJwkSetIsPublic() throws Exception {
        mockMvc.perform(get("/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys[0].kid").value(TestKeys.KEYS.signingKid()))
                .andExpect(jsonPath("$.keys[0].alg").value("RS256"))
                .andExpect(jsonPath("$.keys[0].d").doesNotExist());
    }

    @Test
    void registerAccepts72BytesOfAccentedLetters() throws Exception {
        // 24 x "ệ" = 72 bytes, exactly what bcrypt takes
        mockMvc.perform(post("/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"sv@nambede.local\",\"fullName\":\"Sinh Viên\",\"password\":\""
                                + "ệ".repeat(24) + "\"}"))
                .andExpect(status().isCreated());
    }
}
