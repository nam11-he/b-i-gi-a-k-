package vn.edu.qnu.st.nambede.auth.auth.dto;

import vn.edu.qnu.st.nambede.auth.user.dto.UserResponse;

/** expiresIn is in seconds. */
public record LoginResponse(String accessToken, String tokenType, long expiresIn, UserResponse user) {
}
