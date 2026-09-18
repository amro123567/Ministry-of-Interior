package com.moi.cts.service;

import com.moi.cts.dto.MiscDtos.AttachmentDto;
import com.moi.cts.entity.Attachment;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.AttachmentRepository;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
public class AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final CorrespondenceRequestRepository requestRepository;
    private final AppUserRepository userRepository;
    private final AuditService auditService;
    private final Path documentsDir;

    public AttachmentService(AttachmentRepository attachmentRepository,
                              CorrespondenceRequestRepository requestRepository,
                              AppUserRepository userRepository, AuditService auditService,
                              @Value("${cts.storage.documents-dir}") String documentsDir) {
        this.attachmentRepository = attachmentRepository;
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
        this.documentsDir = Path.of(documentsDir);
        try {
            Files.createDirectories(this.documentsDir);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create document storage directory: " + documentsDir, e);
        }
    }

    @Transactional
    public AttachmentDto upload(Long requestId, MultipartFile file, AppUserPrincipal actor) {
        if (file.isEmpty()) throw new BadRequestException("The uploaded file is empty.");
        CorrespondenceRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Request not found: " + requestId));
        AppUser uploader = userRepository.findById(actor.getId())
                .orElseThrow(() -> new NotFoundException("User vanished"));

        try {
            byte[] bytes = file.getBytes();
            String sha256 = sha256Hex(bytes);
            String storedName = UUID.randomUUID() + "_" + sanitizeFileName(file.getOriginalFilename());
            Path target = documentsDir.resolve(storedName);
            Files.write(target, bytes);

            Attachment attachment = new Attachment();
            attachment.setRequest(request);
            attachment.setFileName(file.getOriginalFilename() != null ? file.getOriginalFilename() : storedName);
            attachment.setStoredPath(target.toString());
            attachment.setContentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
            attachment.setSizeBytes(bytes.length);
            attachment.setSha256(sha256);
            attachment.setUploadedBy(uploader);
            attachment = attachmentRepository.save(attachment);

            auditService.log("CorrespondenceRequest", requestId, "DOCUMENT_UPLOAD", uploader,
                    "file=" + attachment.getFileName() + " sha256=" + sha256);
            return toDto(attachment);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store the uploaded file.", e);
        }
    }

    public List<AttachmentDto> forRequest(Long requestId) {
        return attachmentRepository.findByRequestIdOrderByUploadedAtDesc(requestId)
                .stream().map(this::toDto).toList();
    }

    public Attachment find(Long attachmentId) {
        return attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("Attachment not found: " + attachmentId));
    }

    public byte[] readBytes(Attachment attachment) {
        try {
            return Files.readAllBytes(Path.of(attachment.getStoredPath()));
        } catch (IOException e) {
            throw new IllegalStateException("Stored file is missing on disk: " + attachment.getStoredPath(), e);
        }
    }

    private String sanitizeFileName(String name) {
        if (name == null) return "file";
        return name.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private String sha256Hex(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(data));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private AttachmentDto toDto(Attachment a) {
        return new AttachmentDto(a.getId(), a.getFileName(), a.getContentType(), a.getSizeBytes(),
                a.getSha256(), a.getUploadedBy().getFullName(), a.getUploadedAt());
    }
}
