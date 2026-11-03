package com.moi.cts;

import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.Attachment;
import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.AttachmentRepository;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.AttachmentService;
import com.moi.cts.service.AuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** UAT defect D1: the upload endpoint used to accept any file type, including .exe. */
class AttachmentTypeValidationTest {

    @TempDir Path dir;
    AttachmentRepository attachments = mock(AttachmentRepository.class);
    AttachmentService service;
    AppUserPrincipal actor = mock(AppUserPrincipal.class);

    @BeforeEach
    void setUp() {
        CorrespondenceRequestRepository requests = mock(CorrespondenceRequestRepository.class);
        AppUserRepository users = mock(AppUserRepository.class);
        AppUser user = mock(AppUser.class);
        when(user.getFullName()).thenReturn("Tester");
        when(actor.getId()).thenReturn(1L);
        when(requests.findById(1L)).thenReturn(Optional.of(mock(CorrespondenceRequest.class)));
        when(users.findById(1L)).thenReturn(Optional.of(user));
        when(attachments.save(any(Attachment.class))).thenAnswer(i -> i.getArgument(0));
        service = new AttachmentService(attachments, requests, users, mock(AuditService.class), dir.toString());
    }

    private MockMultipartFile file(String name) {
        return new MockMultipartFile("file", name, "application/octet-stream", "data".getBytes());
    }

    @Test
    void executableIsRejectedAndNothingIsStored() {
        assertThrows(BadRequestException.class, () -> service.upload(1L, file("malware.exe"), actor));
        verify(attachments, never()).save(any());
        assertDirEmpty();
    }

    @Test
    void doubleExtensionAndNoExtensionAreRejected() {
        assertThrows(BadRequestException.class, () -> service.upload(1L, file("report.pdf.exe"), actor));
        assertThrows(BadRequestException.class, () -> service.upload(1L, file("script"), actor));
        assertThrows(BadRequestException.class, () -> service.upload(1L, file("run.SH"), actor));
    }

    @Test
    void ordinaryDocumentsAreAcceptedRegardlessOfCase() {
        assertDoesNotThrow(() -> service.upload(1L, file("letter.pdf"), actor));
        assertDoesNotThrow(() -> service.upload(1L, file("SCAN.JPG"), actor));
        assertDoesNotThrow(() -> service.upload(1L, file("notes.txt"), actor));
    }

    private void assertDirEmpty() {
        String[] left = dir.toFile().list();
        org.junit.jupiter.api.Assertions.assertEquals(0, left == null ? 0 : left.length);
    }
}
