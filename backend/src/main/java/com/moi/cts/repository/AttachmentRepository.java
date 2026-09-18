package com.moi.cts.repository;

import com.moi.cts.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByRequestIdOrderByUploadedAtDesc(Long requestId);
}
