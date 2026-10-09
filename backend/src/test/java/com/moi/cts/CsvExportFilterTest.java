package com.moi.cts;

import com.moi.cts.dto.RequestDtos.RequestFilter;
import com.moi.cts.dto.RequestDtos.RequestSummaryDto;
import com.moi.cts.service.CsvExportService;
import com.moi.cts.service.RequestService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The CSV export must contain exactly the rows the filtered list shows. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CsvExportFilterTest {

    @Autowired RequestService requestService;
    @Autowired CsvExportService csvExportService;

    private static RequestFilter filter(String status, String priority, String direction) {
        return new RequestFilter(status, null, null, null, priority, direction, null, null, null);
    }

    private List<String> exportedReferences(RequestFilter f) {
        String csv = new String(csvExportService.requestsCsv(f, null), StandardCharsets.UTF_8);
        return Arrays.stream(csv.split("\\R"))
                .filter(line -> line.startsWith("\"CTS-"))
                .map(line -> line.substring(1, line.indexOf('"', 1)))
                .toList();
    }

    private List<String> listedReferences(RequestFilter f) {
        return requestService.list(f, null).stream().map(RequestSummaryDto::referenceNumber).toList();
    }

    @Test
    void unfilteredExportContainsEveryRequest() {
        RequestFilter all = filter(null, null, null);
        assertThat(exportedReferences(all)).isNotEmpty()
                .containsExactlyInAnyOrderElementsOf(listedReferences(all));
    }

    @Test
    void exportHonoursStatusFilter() {
        RequestFilter closed = filter("APPROVED", null, null);
        List<String> listed = listedReferences(closed);
        assertThat(exportedReferences(closed)).containsExactlyInAnyOrderElementsOf(listed);
        assertThat(listed.size()).isLessThanOrEqualTo(listedReferences(filter(null, null, null)).size());
    }

    @Test
    void exportHonoursCombinedFilters() {
        RequestFilter f = filter("DRAFT", "HIGH", "INCOMING");
        assertThat(exportedReferences(f)).containsExactlyInAnyOrderElementsOf(listedReferences(f));
    }
}
