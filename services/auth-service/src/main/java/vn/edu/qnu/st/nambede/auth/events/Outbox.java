package vn.edu.qnu.st.nambede.auth.events;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import vn.edu.qnu.st.nambede.auth.common.RequestIdFilter;

/**
 * Records an event in the database, inside the caller's transaction: the event exists if and only if the change it
 * describes was committed. {@link OutboxPublisher} sends it to RabbitMQ afterwards.
 */
@Component
public class Outbox {

    private final OutboxRepository repository;
    private final JsonMapper jsonMapper;

    public Outbox(OutboxRepository repository, JsonMapper jsonMapper) {
        this.repository = repository;
        this.jsonMapper = jsonMapper;
    }

    /** {@code data} is turned into JSON; consumers read it by field name. Envelope: id, type, occurredAt, requestId, data. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void add(String type, Object data) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("id", id.toString());
        message.put("type", type);
        message.put("occurredAt", now.toString());
        // The client request that caused the event: consumers log it too, so the logs connect across services
        message.put("requestId", RequestIdFilter.current());
        message.put("data", data);
        repository.save(new OutboxEvent(id, type, jsonMapper.writeValueAsString(message), now));
    }
}
