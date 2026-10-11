package vn.edu.qnu.st.nambede.auth.auth;

import org.springframework.http.HttpStatus;
import vn.edu.qnu.st.nambede.auth.common.ApiException;

/** 429 for an email with too many failed sign-ins; the answer carries a Retry-After header. */
public class TooManyLoginsException extends ApiException {

    private final long retryAfterSeconds;

    public TooManyLoginsException(long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS,
                "Too many failed sign-ins, try again in " + retryAfterSeconds + " seconds");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
