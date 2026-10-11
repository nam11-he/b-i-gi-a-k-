package vn.edu.qnu.st.nambede.auth.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * X-Request-ID: the id the gateway gave the client request (a new one if missing or malformed). It goes into the
 * logging MDC, so every log line of this request shows it (logging.pattern.correlation), and back in the response.
 * Calls to other services and events carry it on, so {@code docker compose logs | grep <id>} shows the whole path.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-ID";
    public static final String MDC_KEY = "requestId";
    private static final Pattern VALID = Pattern.compile("[A-Za-z0-9._-]{1,64}");
    private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

    /** The id of the request being handled on this thread, or null (e.g. in a scheduled job). */
    public static String current() {
        return MDC.get(MDC_KEY);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String id = request.getHeader(HEADER);
        if (id == null || !VALID.matcher(id).matches()) {
            id = UUID.randomUUID().toString().replace("-", "");
        }
        MDC.put(MDC_KEY, id);
        response.setHeader(HEADER, id);
        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            // Docker's health checks every few seconds are not worth a line
            if (!request.getRequestURI().startsWith("/actuator")) {
                log.info("{} {} {} {} ms", request.getMethod(), request.getRequestURI(), response.getStatus(),
                        (System.nanoTime() - started) / 1_000_000);
            }
            MDC.remove(MDC_KEY);
        }
    }
}
