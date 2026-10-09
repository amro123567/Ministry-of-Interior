package com.moi.cts;

import com.moi.cts.config.ReferenceNumberMigration;
import com.moi.cts.service.ReferenceNumberService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** A failed reference-number conversion must not stop the application from starting. */
class ReferenceNumberMigrationTest {

    @Test
    void failureIsLoggedNotThrown() {
        ReferenceNumberService service = mock(ReferenceNumberService.class);
        when(service.renumberLegacy()).thenThrow(new IllegalStateException("boom"));

        assertThatCode(() -> new ReferenceNumberMigration(service).renumberLegacyReferences())
                .doesNotThrowAnyException();
        verify(service).renumberLegacy();
    }

    @Test
    void successPathStillRuns() {
        ReferenceNumberService service = mock(ReferenceNumberService.class);
        when(service.renumberLegacy()).thenReturn(3);

        assertThatCode(() -> new ReferenceNumberMigration(service).renumberLegacyReferences())
                .doesNotThrowAnyException();
        verify(service).renumberLegacy();
    }
}
