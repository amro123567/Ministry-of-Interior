package com.moi.cts.controller;

import com.moi.cts.audit.Audited;
import com.moi.cts.dto.MiscDtos.AttachmentDto;
import com.moi.cts.entity.Attachment;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.AttachmentService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
public class AttachmentController {

    private final AttachmentService attachmentService;

    public AttachmentController(AttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    @PostMapping(value = "/api/requests/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDto> upload(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                  @AuthenticationPrincipal AppUserPrincipal actor) {
        return ResponseEntity.ok(attachmentService.upload(id, file, actor));
    }

    @GetMapping("/api/requests/{id}/documents")
    public List<AttachmentDto> list(@PathVariable Long id) { return attachmentService.forRequest(id); }

    @GetMapping("/api/documents/{attachmentId}/download")
    @Audited(entityType = "Attachment", action = "DOWNLOAD")
    public ResponseEntity<byte[]> download(@PathVariable Long attachmentId,
                                            @AuthenticationPrincipal AppUserPrincipal actor) {
        Attachment attachment = attachmentService.find(attachmentId);
        byte[] bytes = attachmentService.readBytes(attachment);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(attachment.getFileName()).build().toString())
                .body(bytes);
    }
}
