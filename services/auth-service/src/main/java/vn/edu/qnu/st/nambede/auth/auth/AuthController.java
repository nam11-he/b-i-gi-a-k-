package vn.edu.qnu.st.nambede.auth.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.qnu.st.nambede.auth.auth.dto.LoginRequest;
import vn.edu.qnu.st.nambede.auth.auth.dto.LoginResponse;
import vn.edu.qnu.st.nambede.auth.auth.dto.RegisterRequest;
import vn.edu.qnu.st.nambede.auth.common.ApiException;

@Tag(name = "Đăng nhập", description = "Đăng nhập và tự đăng ký; trả JWT dùng cho mọi API khác")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Đăng nhập, nhận JWT")
    @SecurityRequirements
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Token còn dùng được không: 204, hoặc 401 kèm lý do (tài khoản bị khóa, đã đổi vai trò, đã xóa). Gateway hỏi mỗi request (lưu đệm vài giây)")
    @GetMapping("/session")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void session(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        authService.checkSession(authorization.substring("Bearer ".length()).trim());
    }

    @Operation(summary = "Sinh viên tự đăng ký (luôn là STUDENT), nhận JWT ngay")
    @SecurityRequirements
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public LoginResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }
}
