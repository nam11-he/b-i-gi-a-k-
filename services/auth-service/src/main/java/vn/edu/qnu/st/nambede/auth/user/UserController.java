package vn.edu.qnu.st.nambede.auth.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.qnu.st.nambede.auth.security.AuthUser;
import vn.edu.qnu.st.nambede.auth.user.dto.AccountTypeResponse;
import vn.edu.qnu.st.nambede.auth.user.dto.ChangePasswordRequest;
import vn.edu.qnu.st.nambede.auth.user.dto.CreateUserRequest;
import vn.edu.qnu.st.nambede.auth.user.dto.UpdateAccountTypeRequest;
import vn.edu.qnu.st.nambede.auth.user.dto.UpdateRoleRequest;
import vn.edu.qnu.st.nambede.auth.user.dto.UpdateStatusRequest;
import vn.edu.qnu.st.nambede.auth.user.dto.UpdateUserRequest;
import vn.edu.qnu.st.nambede.auth.user.dto.UserResponse;

/**
 * Access rules are in SecurityConfig: GET /users/me, /users/lookup, /users/{id} and PUT /users/me, /users/me/password
 * for any signed-in user, the rest ADMIN only.
 */
@Tag(name = "Người dùng", description = "Tài khoản, vai trò, trạng thái, gói FREE / VIP")
@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "Thông tin của chính mình")
    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal AuthUser currentUser) {
        return userService.get(currentUser.id());
    }

    /** Any signed-in user changes their own name. Email cannot be changed; role, status and account type stay with admins. */
    @Operation(summary = "Tự đổi họ tên")
    @PutMapping("/me")
    public UserResponse updateMe(@AuthenticationPrincipal AuthUser currentUser,
            @Valid @RequestBody UpdateUserRequest request) {
        return userService.updateFullName(currentUser.id(), request.fullName());
    }

    @Operation(summary = "Tự đổi mật khẩu; sai mật khẩu hiện tại thì 403")
    @PutMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AuthUser currentUser,
            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(currentUser.id(), request.currentPassword(), request.newPassword());
    }

    @Operation(summary = "Danh sách người dùng, lọc theo vai trò (ADMIN)")
    @GetMapping
    public List<UserResponse> list(@RequestParam(required = false) Role role) {
        return userService.list(role);
    }

    @Operation(summary = "Tạo tài khoản với vai trò bất kỳ (ADMIN)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        User user = userService.create(request.email(), request.password(), request.fullName(), request.role());
        return UserResponse.from(user);
    }

    /** Several users in one call, e.g. class-service showing the names of a class's students. */
    @Operation(summary = "Thông tin nhiều người dùng một lần, ví dụ ids=2,3 (các service khác dùng để lấy họ tên)")
    @GetMapping("/lookup")
    public List<UserResponse> lookup(@RequestParam List<Long> ids) {
        return userService.lookup(ids);
    }

    @Operation(summary = "Một người dùng")
    @GetMapping("/{id}")
    public UserResponse get(@PathVariable Long id) {
        return userService.get(id);
    }

    @Operation(summary = "Đổi họ tên một người dùng (ADMIN)")
    @PutMapping("/{id}")
    public UserResponse update(@PathVariable Long id, @Valid @RequestBody UpdateUserRequest request) {
        return userService.updateFullName(id, request.fullName());
    }

    @Operation(summary = "Xóa tài khoản (ADMIN, không xóa được chính mình)")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal AuthUser currentUser) {
        userService.delete(id, currentUser.id());
    }

    @Operation(summary = "Đổi vai trò (ADMIN)")
    @PutMapping("/{id}/role")
    public UserResponse changeRole(@PathVariable Long id, @Valid @RequestBody UpdateRoleRequest request,
            @AuthenticationPrincipal AuthUser currentUser) {
        return userService.changeRole(id, request.role(), currentUser.id());
    }

    @Operation(summary = "Khóa hoặc mở khóa tài khoản (ADMIN)")
    @PutMapping("/{id}/status")
    public UserResponse changeStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthUser currentUser) {
        return userService.changeStatus(id, request.status(), currentUser.id());
    }

    @Operation(summary = "Chuyển gói FREE / VIP (ADMIN)")
    @PutMapping("/{id}/account-type")
    public UserResponse changeAccountType(@PathVariable Long id,
            @Valid @RequestBody UpdateAccountTypeRequest request) {
        return userService.changeAccountType(id, request.accountType());
    }

    @Operation(summary = "Gói FREE / VIP của một người dùng (Learning Service dùng)")
    @GetMapping("/{id}/account-type")
    public AccountTypeResponse accountType(@PathVariable Long id) {
        return userService.accountType(id);
    }
}
