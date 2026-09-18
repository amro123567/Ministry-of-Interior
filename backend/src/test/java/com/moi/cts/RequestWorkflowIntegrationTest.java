package com.moi.cts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end tests over the REST API (MockMvc, H2 in-memory, see
 * application-test.yml). Exercises the workflow, security and validation
 * rules this rewrite moved from database triggers into RequestService --
 * these are the "business-logic tests" the Flask system's 54 tests never
 * had, since all of those were assertions against the database directly.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RequestWorkflowIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    private String tokenFor(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("accessToken").asText();
    }

    private String refreshTokenFor(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("refreshToken").asText();
    }

    // ---- authentication -----------------------------------------------

    @Test
    void loginWithValidCredentialsReturnsAccessAndRefreshTokens() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"officer\",\"password\":\"Officer1234!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.roles[0]").value("OFFICER"));
    }

    @Test
    void loginWithWrongPasswordIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"officer\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void requestWithoutATokenIsRefused() throws Exception {
        mockMvc.perform(get("/api/requests"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void refreshRotatesTheTokenAndInvalidatesThePreviousOne() throws Exception {
        String refresh = refreshTokenFor("officer", "Officer1234!");

        MvcResult first = mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String rotated = objectMapper.readTree(first.getResponse().getContentAsString())
                .get("refreshToken").asText();
        assertThat(rotated).isNotEqualTo(refresh);

        // the original refresh token was revoked by rotation
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheRefreshToken() throws Exception {
        String refresh = refreshTokenFor("officer", "Officer1234!");
        mockMvc.perform(post("/api/auth/logout")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ---- citizens ---------------------------------------------------------

    @Test
    void citizenSearchFindsBySubstringOfEitherName() throws Exception {
        String token = tokenFor("officer", "Officer1234!");
        mockMvc.perform(get("/api/citizens").param("q", "Kanaan")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].registryNumber").value("REG-100234"));
    }

    // ---- workflow: the legal-transition matrix -----------------------------

    @Test
    void fullLifecycleCreateSubmitReviewApproveArchiveSucceeds() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");

        long citizenId = createCitizen(officerToken, "REG-900001", "Test", "Person");
        long docTypeId = firstDocumentTypeId(officerToken);
        long officeId = firstOfficeId(officerToken);

        long requestId = createRequest(officerToken, citizenId, docTypeId, officeId);
        assertStatus(officerToken, requestId, "DRAFT");

        transition(officerToken, requestId, "SUBMITTED", null).andExpect(status().isOk());
        assertStatus(officerToken, requestId, "SUBMITTED");

        transition(managerToken, requestId, "UNDER_REVIEW", null).andExpect(status().isOk());
        transition(managerToken, requestId, "APPROVED", null).andExpect(status().isOk());
        assertStatus(officerToken, requestId, "APPROVED");

        transition(officerToken, requestId, "ARCHIVED", null).andExpect(status().isOk());
        assertStatus(officerToken, requestId, "ARCHIVED");

        // the full history trail is queryable
        mockMvc.perform(get("/api/requests/" + requestId + "/history")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5)); // create + 4 transitions
    }

    @Test
    void skippingAStateInTheWorkflowIsRejected() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900002", "Skip", "State");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        // DRAFT -> APPROVED is not a legal transition
        transition(officerToken, requestId, "APPROVED", null)
                .andExpect(status().isBadRequest());
    }

    @Test
    void transitionRequiringTheWrongRoleIsRejected() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900003", "Wrong", "Role");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));
        transition(officerToken, requestId, "SUBMITTED", null).andExpect(status().isOk());

        // UNDER_REVIEW -> APPROVED requires MANAGER, not OFFICER
        transition(officerToken, requestId, "UNDER_REVIEW", null).andExpect(status().isBadRequest());
    }

    @Test
    void rejectingARequestWithoutAReasonIsRefused() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        long citizenId = createCitizen(officerToken, "REG-900004", "No", "Reason");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));
        transition(officerToken, requestId, "SUBMITTED", null).andExpect(status().isOk());
        transition(managerToken, requestId, "UNDER_REVIEW", null).andExpect(status().isOk());

        mockMvc.perform(patch("/api/requests/" + requestId + "/transition")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"toStatus\":\"REJECTED\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/requests/" + requestId + "/transition")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"toStatus\":\"REJECTED\",\"rejectionReason\":\"Missing supporting documents\"}"))
                .andExpect(status().isOk());
    }

    // ---- documents ----------------------------------------------------------

    @Test
    void uploadedDocumentHashMatchesSha256OfItsBytesAndDownloadReturnsTheSameBytes() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900005", "Doc", "Owner");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        byte[] content = "hello correspondence tracking system".getBytes();
        String expectedSha256 = sha256Hex(content);

        MockMultipartFile file = new MockMultipartFile("file", "test.txt", "text/plain", content);
        MvcResult uploadResult = mockMvc.perform(multipart("/api/requests/" + requestId + "/documents")
                        .file(file)
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sha256").value(expectedSha256))
                .andReturn();

        long attachmentId = objectMapper.readTree(uploadResult.getResponse().getContentAsString()).get("id").asLong();

        MvcResult download = mockMvc.perform(get("/api/documents/" + attachmentId + "/download")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(download.getResponse().getContentAsByteArray()).isEqualTo(content);
    }

    // ---- dashboard & export ---------------------------------------------------

    @Test
    void dashboardSummaryCountsAtLeastTheSeededRequests() throws Exception {
        String token = tokenFor("viewer", "Viewer1234!");
        mockMvc.perform(get("/api/dashboard/summary").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total", org.hamcrest.Matchers.greaterThanOrEqualTo(4)));
    }

    @Test
    void csvExportContainsTheSeededReferenceNumbers() throws Exception {
        String token = tokenFor("viewer", "Viewer1234!");
        MvcResult result = mockMvc.perform(get("/api/requests/export").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("correspondence_requests.csv")))
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).contains("CTS-DEMO-1");
    }

    // ---- audit ----------------------------------------------------------------

    @Test
    void creatingAndTransitioningARequestWritesAuditEntries() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900006", "Audit", "Trail");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));
        transition(officerToken, requestId, "SUBMITTED", null).andExpect(status().isOk());

        mockMvc.perform(get("/api/audit")
                        .param("entityType", "CorrespondenceRequest")
                        .param("entityId", String.valueOf(requestId))
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    // ---- helpers ----------------------------------------------------------

    private long createCitizen(String token, String registryNumber, String first, String last) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/citizens")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"registryNumber\":\"" + registryNumber + "\",\"firstNameEn\":\"" + first
                                + "\",\"lastNameEn\":\"" + last + "\",\"gender\":\"M\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long firstDocumentTypeId(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/document-types").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get(0).get("id").asLong();
    }

    private long firstOfficeId(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/offices").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get(0).get("id").asLong();
    }

    private long createRequest(String token, long citizenId, long docTypeId, long officeId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/requests")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + docTypeId
                                + ",\"officeId\":" + officeId + "}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private org.springframework.test.web.servlet.ResultActions transition(String token, long requestId,
                                                                            String toStatus, String rejectionReason) throws Exception {
        String body = rejectionReason == null
                ? "{\"toStatus\":\"" + toStatus + "\"}"
                : "{\"toStatus\":\"" + toStatus + "\",\"rejectionReason\":\"" + rejectionReason + "\"}";
        return mockMvc.perform(patch("/api/requests/" + requestId + "/transition")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content(body));
    }

    private void assertStatus(String token, long requestId, String expected) throws Exception {
        mockMvc.perform(get("/api/requests/" + requestId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(expected));
    }

    private String sha256Hex(byte[] data) throws Exception {
        java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
        return java.util.HexFormat.of().formatHex(digest.digest(data));
    }
}
