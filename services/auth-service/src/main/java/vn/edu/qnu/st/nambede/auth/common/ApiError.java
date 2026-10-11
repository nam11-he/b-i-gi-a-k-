package vn.edu.qnu.st.nambede.auth.common;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;

/** Error body shared by every NamBeDe service: {"status", "error", "message", "path"}. */
public record ApiError(int status, String error, String message, String path) {

    public static ApiError of(HttpStatusCode status, String message, String path) {
        HttpStatus known = HttpStatus.resolve(status.value());
        return new ApiError(status.value(), known != null ? known.getReasonPhrase() : "Error", message, path);
    }
}
