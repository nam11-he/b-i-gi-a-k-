package vn.edu.qnu.st.nambede.auth.jwt;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SigningKeyRepository extends JpaRepository<SigningKey, String> {

    /** Newest first: the first one signs, all of them verify (tokens signed before a key change stay valid). */
    List<SigningKey> findAllByOrderByCreatedAtDesc();
}
