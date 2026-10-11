package vn.edu.qnu.st.nambede.auth.user;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.qnu.st.nambede.auth.config.SecurityConfig;
import vn.edu.qnu.st.nambede.auth.jwt.JwtService;
import vn.edu.qnu.st.nambede.auth.jwt.TestKeys;
import vn.edu.qnu.st.nambede.auth.user.dto.UserResponse;

@WebMvcTest(controllers = UserController.class)
@Import({SecurityConfig.class, JwtService.class, TestKeys.class})
class UserControllerTest {

    private static final UserResponse ADMIN = new UserResponse(1L, "admin@nambede.local", "Administrator",
            Role.ADMIN, UserStatus.ACTIVE, AccountType.FREE, Instant.parse("2026-10-01T00:00:00Z"));

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private UserService userService;

    private String bearer(long userId, Role role) {
        return "Bearer " + jwtService.issue(userId, "user" + userId + "@nambede.local", "User " + userId, role, 0);
    }

    @Test
    void listWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/users"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.path").value("/users"));
    }

    @Test
    void listWithInvalidTokenReturns401() throws Exception {
        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid or expired token"));
    }

    @Test
    void listAsStudentReturns403() throws Exception {
        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, bearer(2L, Role.STUDENT)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void listAsAdminReturnsUsers() throws Exception {
        when(userService.list(null)).thenReturn(List.of(ADMIN));

        mockMvc.perform(get("/users").header(HttpHeaders.AUTHORIZATION, bearer(1L, Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("admin@nambede.local"))
                .andExpect(jsonPath("$[0].role").value("ADMIN"));
    }

    @Test
    void lookupIsAllowedForAnySignedInUser() throws Exception {
        when(userService.lookup(List.of(1L, 2L))).thenReturn(List.of(ADMIN));

        mockMvc.perform(get("/users/lookup").param("ids", "1,2")
                        .header(HttpHeaders.AUTHORIZATION, bearer(3L, Role.TEACHER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fullName").value("Administrator"));
    }

    @Test
    void lookupWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/users/lookup").param("ids", "1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void meReturnsTheCaller() throws Exception {
        when(userService.get(1L)).thenReturn(ADMIN);

        mockMvc.perform(get("/users/me").header(HttpHeaders.AUTHORIZATION, bearer(1L, Role.ADMIN)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.fullName").value("Administrator"));
    }

    @Test
    void anySignedInUserChangesTheirOwnName() throws Exception {
        UserResponse renamed = new UserResponse(2L, "user2@nambede.local", "Nguyễn Văn An", Role.STUDENT,
                UserStatus.ACTIVE, AccountType.FREE, Instant.parse("2026-10-01T00:00:00Z"));
        when(userService.updateFullName(2L, "Nguyễn Văn An")).thenReturn(renamed);

        mockMvc.perform(put("/users/me").header(HttpHeaders.AUTHORIZATION, bearer(2L, Role.STUDENT))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Nguyễn Văn An\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Nguyễn Văn An"));
    }

    @Test
    void anySignedInUserChangesTheirOwnPassword() throws Exception {
        mockMvc.perform(put("/users/me/password").header(HttpHeaders.AUTHORIZATION, bearer(3L, Role.TEACHER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Teacher@123\",\"newPassword\":\"Moi@2026\"}"))
                .andExpect(status().isNoContent());

        verify(userService).changePassword(3L, "Teacher@123", "Moi@2026");
    }

    @Test
    void newPasswordNeedsSixCharacters() throws Exception {
        mockMvc.perform(put("/users/me/password").header(HttpHeaders.AUTHORIZATION, bearer(3L, Role.TEACHER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Teacher@123\",\"newPassword\":\"12345\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("newPassword")));
    }

    @Test
    void newPasswordOver72BytesReturns400() throws Exception {
        // 40 accented letters: under 72 characters, but 120 bytes, more than bcrypt accepts
        mockMvc.perform(put("/users/me/password").header(HttpHeaders.AUTHORIZATION, bearer(3L, Role.TEACHER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"Teacher@123\",\"newPassword\":\"" + "ệ".repeat(40) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("newPassword: must be at most 72 bytes")));

        verify(userService, never()).changePassword(anyLong(), anyString(), anyString());
    }

    @Test
    void createdUserPasswordOver72BytesReturns400() throws Exception {
        mockMvc.perform(post("/users").header(HttpHeaders.AUTHORIZATION, bearer(1L, Role.ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"gv@nambede.local\",\"fullName\":\"Giảng Viên\",\"role\":\"TEACHER\","
                                + "\"password\":\"" + "ệ".repeat(40) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("password: must be at most 72 bytes")));

        verify(userService, never()).create(anyString(), anyString(), anyString(), any(Role.class));
    }

    @Test
    void changingOtherUsersStillNeedsAnAdmin() throws Exception {
        mockMvc.perform(put("/users/5").header(HttpHeaders.AUTHORIZATION, bearer(2L, Role.STUDENT))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Tên khác\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/users/me").contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Ai đó\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void everyAnswerCarriesTheRequestId() throws Exception {
        // Kept when the gateway sends one (even on a 401), made up when it is missing
        mockMvc.perform(get("/users/me").header("X-Request-ID", "gw-123"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("X-Request-ID", "gw-123"));
        mockMvc.perform(get("/users/me"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("X-Request-ID", org.hamcrest.Matchers.matchesPattern("[0-9a-f]{32}")));
    }
}
