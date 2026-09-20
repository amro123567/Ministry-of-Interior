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

        // Reusing an already-rotated refresh token is the classic signature
        // of token theft/replay, so it must show up in the audit trail --
        // unlike an everyday expired-token rejection, which shouldn't.
        // (The audit log itself needs the AUDIT_VIEW permission, which only
        // ADMIN is granted -- see RequestService/DataSeeder's permission
        // catalog -- so this checks it as admin, not as the officer whose
        // refresh token was reused.)
        String adminToken = tokenFor("admin", "Admin1234!");
        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.action == 'REFRESH_TOKEN_REUSE_DETECTED')]").isNotEmpty());
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

    @Test
    void logoutAlsoRevokesTheAccessTokenItself() throws Exception {
        // Before this change, logout only revoked the refresh token -- the
        // access token already issued stayed valid until its own natural
        // expiry, even after the user logged out. This test is the one
        // that would have failed against the old behaviour.
        String token = tokenFor("officer", "Officer1234!");
        mockMvc.perform(get("/api/citizens").param("q", "Kanaan").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"irrelevant-for-this-test\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/citizens").param("q", "Kanaan").header("Authorization", "Bearer " + token))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void repeatedFailedLoginsLockTheAccountEvenWithTheCorrectPasswordAfterwards() throws Exception {
        // cts.security.max-login-attempts is 5 in application-test.yml.
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType("application/json")
                            .content("{\"username\":\"manager\",\"password\":\"wrong-password\"}"))
                    .andExpect(status().isUnauthorized());
        }
        // The 6th attempt, even with the RIGHT password, is refused because
        // the account is now locked -- proving the lock is enforced before
        // credentials are checked, not just a delayed rejection.
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"manager\",\"password\":\"Manager1234!\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsStringIgnoringCase("locked")));
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

        // The audit log itself needs the AUDIT_VIEW permission (ADMIN
        // only), independent of whoever generated the entries being
        // checked -- an officer can cause an audit entry to be written
        // without being able to read the audit log back.
        String adminToken = tokenFor("admin", "Admin1234!");
        mockMvc.perform(get("/api/audit")
                        .param("entityType", "CorrespondenceRequest")
                        .param("entityId", String.valueOf(requestId))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()", org.hamcrest.Matchers.greaterThanOrEqualTo(2)));
    }

    // ---- permission-based RBAC ---------------------------------------------

    @Test
    void auditAndReportsEndpointsAreGatedByPermissionNotJustHiddenInTheNav() throws Exception {
        // AUDIT_VIEW and REPORTS_VIEW are only granted (via role_permissions,
        // seeded in DataSeeder) to the roles that should see them -- this
        // checks the backend actually refuses everyone else, not just that
        // the frontend nav hides the link.
        String viewerToken = tokenFor("viewer", "Viewer1234!");
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        String adminToken = tokenFor("admin", "Admin1234!");

        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/reports/summary").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/reports/summary").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/reports/summary").header("Authorization", "Bearer " + managerToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/reports/summary").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void citizenRegistryWritesAreGatedByCitizenManageButReadsAreNot() throws Exception {
        // CITIZEN_MANAGE is granted to ADMIN/MANAGER/OFFICER (the latter is
        // also what createCitizen()'s own officerToken relies on throughout
        // this file) but deliberately withheld from VIEWER -- confirming the
        // backend actually refuses a create/lineage-edit attempt, not just
        // that the frontend hides the button.
        String viewerToken = tokenFor("viewer", "Viewer1234!");
        String officerToken = tokenFor("officer", "Officer1234!");

        mockMvc.perform(post("/api/citizens")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json")
                        .content("{\"registryNumber\":\"REG-930001\",\"firstNameEn\":\"Should\",\"lastNameEn\":\"Fail\",\"gender\":\"M\"}"))
                .andExpect(status().isForbidden());

        long citizenId = createCitizen(officerToken, "REG-930002", "Lineage", "Gate");
        mockMvc.perform(patch("/api/citizens/" + citizenId + "/lineage")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json")
                        .content("{\"fatherNameUnregistered\":\"Someone\"}"))
                .andExpect(status().isForbidden());

        // But VIEWER can still read the registry -- only the writes are gated.
        mockMvc.perform(get("/api/citizens/" + citizenId).header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk());
    }

    @Test
    void familyRecordAndGuardianshipWritesAreGatedByCitizenManage() throws Exception {
        String viewerToken = tokenFor("viewer", "Viewer1234!");
        String officerToken = tokenFor("officer", "Officer1234!");
        long headId = createCitizen(officerToken, "REG-930003", "Gate", "Head");
        long courtId = firstCourtId(officerToken);

        mockMvc.perform(post("/api/family-records")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json")
                        .content("{\"familyBookNumber\":\"FB-GATE-1\",\"headOfHouseholdId\":" + headId + "}"))
                .andExpect(status().isForbidden());

        long familyRecordId = objectMapper.readTree(mockMvc.perform(post("/api/family-records")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"familyBookNumber\":\"FB-GATE-2\",\"headOfHouseholdId\":" + headId + "}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/family-records/" + familyRecordId + "/members")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + headId + ",\"relationship\":\"OTHER\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/guardianships")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json")
                        .content("{\"minorCitizenId\":" + headId + ",\"guardianCitizenId\":" + headId
                                + ",\"guardianshipType\":\"FULL\",\"courtDecisionNumber\":\"X-2\",\"courtId\":" + courtId
                                + ",\"startDate\":\"2020-01-01\"}"))
                .andExpect(status().isForbidden());

        // Reads stay open to VIEWER regardless.
        mockMvc.perform(get("/api/family-records/" + familyRecordId).header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk());
    }

    @Test
    void decidingARegistryTransferOrAmendmentRequiresCitizenRegistryDecideNotJustCitizenManage() throws Exception {
        // OFFICER holds CITIZEN_MANAGE (can request) but not
        // CITIZEN_REGISTRY_DECIDE (can't decide) -- this is the split
        // itself, checked directly, separate from the SI-12 business-rule
        // tests above which use MANAGER/ADMIN throughout.
        String officerToken = tokenFor("officer", "Officer1234!");
        long beirutOfficeId = officeIdByCode(officerToken, "BEY");
        long tripoliOfficeId = officeIdByCode(officerToken, "TRP");
        long citizenId = createCitizenAtOffice(officerToken, "REG-930004", "Decide", "Gate", beirutOfficeId);
        long transferId = objectMapper.readTree(mockMvc.perform(post("/api/registry-transfers")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"toOfficeId\":" + tripoliOfficeId + "}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/registry-transfers/" + transferId + "/decide")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void roleCatalogExposesWhatEachRoleIsActuallyGranted() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");
        mockMvc.perform(get("/api/roles").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'VIEWER')].permissions[0]").doesNotExist())
                .andExpect(jsonPath("$[?(@.name == 'OFFICER')].permissions",
                        org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.hasItem("REQUEST_TRANSITION_SUBMIT"))));
    }

    // ---- reference & organizational hierarchy ------------------------------

    @Test
    void referenceHierarchyEndpointsExposeTheRealLebaneseAdministrativeDivision() throws Exception {
        // These are read-only lookups (like /api/offices, /api/document-types
        // before them) with no dedicated permission -- any authenticated
        // role can read them, checked here with the lowest-privilege login.
        String viewerToken = tokenFor("viewer", "Viewer1234!");

        MvcResult govResult = mockMvc.perform(get("/api/governorates").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode governorates = objectMapper.readTree(govResult.getResponse().getContentAsString());
        assertThat(governorates).hasSize(8);
        long beirutGovId = -1;
        for (JsonNode g : governorates) {
            if (g.get("code").asText().equals("BEY")) beirutGovId = g.get("id").asLong();
        }
        assertThat(beirutGovId).isNotEqualTo(-1);

        MvcResult distResult = mockMvc.perform(get("/api/districts").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode districts = objectMapper.readTree(distResult.getResponse().getContentAsString());
        // Lebanon's real district (qada) count -- not an arbitrary seed size.
        assertThat(districts).hasSize(26);
        boolean beirutDistrictBelongsToBeirutGovernorate = false;
        for (JsonNode d : districts) {
            if (d.get("code").asText().equals("BEY") && d.get("governorateId").asLong() == beirutGovId) {
                beirutDistrictBelongsToBeirutGovernorate = true;
            }
        }
        assertThat(beirutDistrictBelongsToBeirutGovernorate).isTrue();

        mockMvc.perform(get("/api/departments").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'CSA-REG')].parentId").exists());

        mockMvc.perform(get("/api/courts").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.courtType == 'SHARIA')]").exists());

        mockMvc.perform(get("/api/religious-authorities").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.sect == 'Maronite')]").exists());

        mockMvc.perform(get("/api/mukhtars").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].districtId").exists());

        // The two demo offices seeded before this item now carry a real
        // district link instead of a null one.
        mockMvc.perform(get("/api/offices").header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.code == 'BEY')].districtId").exists());
    }

    // ---- citizen registry core: lineage, family, guardianship, transfers, --
    // ---- civil status amendments -------------------------------------------

    @Test
    void creatingACitizenWithBothARegisteredFatherAndAnUnregisteredFatherNameIsRejected() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long fatherId = createCitizen(officerToken, "REG-910001", "Xavier", "Kanaan");
        mockMvc.perform(post("/api/citizens")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"registryNumber\":\"REG-910002\",\"firstNameEn\":\"Yara\",\"lastNameEn\":\"Kanaan\","
                                + "\"gender\":\"F\",\"fatherId\":" + fatherId + ",\"fatherNameUnregistered\":\"Someone Else\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aParentsDateOfBirthMustPrecedeTheChildsOnLineageUpdate() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long olderChildId = createCitizenWithDob(officerToken, "REG-910003", "Older", "Child", "2000-01-01");
        long youngerAllegedParentId = createCitizenWithDob(officerToken, "REG-910004", "Younger", "Parent", "2010-01-01");

        mockMvc.perform(patch("/api/citizens/" + olderChildId + "/lineage")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"fatherId\":" + youngerAllegedParentId + "}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aLineageCycleIsRejectedEvenAcrossThreeGenerations() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        // DOB deliberately omitted on all three: if it were set, SI-3 (parent
        // DOB must precede child's) would reject a cycle attempt for its own
        // reason first, which would mask whether SI-1 (no cycle) is actually
        // being enforced.
        long grandparentId = createCitizen(officerToken, "REG-910005", "Grandparent", "Kanaan");
        long parentId = createCitizen(officerToken, "REG-910006", "Parent", "Kanaan");
        long childId = createCitizen(officerToken, "REG-910007", "Child", "Kanaan");

        mockMvc.perform(patch("/api/citizens/" + parentId + "/lineage")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"fatherId\":" + grandparentId + "}"))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/citizens/" + childId + "/lineage")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"fatherId\":" + parentId + "}"))
                .andExpect(status().isOk());

        // Making the grandchild the grandparent's own father would close a
        // cycle three generations back.
        mockMvc.perform(patch("/api/citizens/" + grandparentId + "/lineage")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"fatherId\":" + childId + "}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aCitizenCannotBeTheirOwnGuardian() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-910008", "Self", "Guardian");
        long courtId = firstCourtId(officerToken);

        mockMvc.perform(post("/api/guardianships")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"minorCitizenId\":" + citizenId + ",\"guardianCitizenId\":" + citizenId
                                + ",\"guardianshipType\":\"FULL\",\"courtDecisionNumber\":\"X-1\",\"courtId\":" + courtId
                                + ",\"startDate\":\"2020-01-01\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registryTransferCannotBeApprovedByItsOwnRequesterAndMovesTheCitizenOnApproval() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long beirutOfficeId = officeIdByCode(officerToken, "BEY");
        long tripoliOfficeId = officeIdByCode(officerToken, "TRP");
        long citizenId = createCitizenAtOffice(officerToken, "REG-910009", "Transfer", "Subject", beirutOfficeId);

        // Requested by MANAGER rather than OFFICER: OFFICER holds
        // CITIZEN_MANAGE but not CITIZEN_REGISTRY_DECIDE (see DataSeeder),
        // so an OFFICER decide-attempt would be rejected at the permission
        // layer (403) before ever reaching the SI-12 self-approval check
        // this test exists to exercise. MANAGER holds both, so its own
        // self-decide attempt below is rejected by that business rule (400),
        // not by a permission it doesn't have.
        MvcResult result = mockMvc.perform(post("/api/registry-transfers")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"toOfficeId\":" + tripoliOfficeId + "}"))
                .andExpect(status().isOk())
                .andReturn();
        long transferId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        // SI-12: the requester cannot also be the approver.
        mockMvc.perform(patch("/api/registry-transfers/" + transferId + "/decide")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/registry-transfers/" + transferId + "/decide")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));

        // Approval has a real effect: the citizen's registered office moved.
        mockMvc.perform(get("/api/citizens/" + citizenId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.officeName").value("Tripoli Civil Status Office"));
    }

    @Test
    void civilStatusAmendmentRequiresALegalBasisAndCannotBeSelfApproved() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long citizenId = createCitizen(officerToken, "REG-910010", "Amend", "Subject");

        // SI-11: legalBasis is required up front, not just at approval time.
        mockMvc.perform(post("/api/civil-status-amendments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"fieldChanged\":\"sect\",\"newValue\":\"Druze\"}"))
                .andExpect(status().isBadRequest());

        // Requested by MANAGER, not OFFICER -- see the registry-transfer
        // test above for why (OFFICER no longer holds CITIZEN_REGISTRY_
        // DECIDE, so it can't be used to exercise the self-approval
        // business rule below without the permission layer intercepting
        // first).
        MvcResult result = mockMvc.perform(post("/api/civil-status-amendments")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"fieldChanged\":\"sect\",\"newValue\":\"Druze\","
                                + "\"legalBasis\":\"Court decision 2026-0099\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long amendmentId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        // SI-12: the same actor cannot approve their own amendment request.
        mockMvc.perform(patch("/api/civil-status-amendments/" + amendmentId + "/decide")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/civil-status-amendments/" + amendmentId + "/decide")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isOk());

        // The whitelist auto-apply on approval actually changed the record.
        mockMvc.perform(get("/api/citizens/" + citizenId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.sect").value("Druze"));
    }

    @Test
    void leavingAFamilyMembershipClosesTheRowInsteadOfDeletingIt() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long headId = createCitizen(officerToken, "REG-910011", "Head", "Household");
        long memberId = createCitizen(officerToken, "REG-910012", "Member", "Household");

        MvcResult frResult = mockMvc.perform(post("/api/family-records")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"familyBookNumber\":\"FB-TEST-1\",\"headOfHouseholdId\":" + headId + "}"))
                .andExpect(status().isOk())
                .andReturn();
        long familyRecordId = objectMapper.readTree(frResult.getResponse().getContentAsString()).get("id").asLong();

        MvcResult memberResult = mockMvc.perform(post("/api/family-records/" + familyRecordId + "/members")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + memberId + ",\"relationship\":\"OTHER\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long membershipId = objectMapper.readTree(memberResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/family-records/" + familyRecordId + "/members/" + membershipId + "/leave")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"leftReason\":\"Moved out\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leftDate").exists());

        // The membership row still shows up in the family record's history,
        // marked closed -- it was never deleted.
        mockMvc.perform(get("/api/family-records/" + familyRecordId)
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members[?(@.id == " + membershipId + ")].leftReason").value("Moved out"));
    }

    // ---- documents: generic supertype + 7 subtypes -------------------------

    @Test
    void birthCertificateCanBeIssuedAndReadBackWithItsSnapshottedParentNames() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-920001", "Newborn", "Kanaan");
        long birthTypeId = documentTypeIdByCode(officerToken, "BIRTH_CERT");
        long officeId = firstOfficeId(officerToken);

        MvcResult result = mockMvc.perform(post("/api/documents/birth-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + birthTypeId
                                + ",\"issuingOfficeId\":" + officeId + ",\"birthPlace\":\"Beirut\","
                                + "\"fatherFullNameSnapshot\":\"Test Father\",\"registrationNumber\":\"BC-TEST-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthPlace").value("Beirut"))
                .andReturn();
        long documentId = objectMapper.readTree(result.getResponse().getContentAsString())
                .get("document").get("id").asLong();

        mockMvc.perform(get("/api/documents/birth-certificates/" + documentId)
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fatherFullNameSnapshot").value("Test Father"))
                .andExpect(jsonPath("$.document.status").value("ISSUED"));

        // Shows up in the citizen's generic document list too.
        mockMvc.perform(get("/api/citizens/" + citizenId + "/documents")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.documentTypeCode == 'BIRTH_CERT')]").exists());
    }

    @Test
    void marryingACitizenToThemselvesIsRejectedAndAValidMarriageSetsBothToMarried() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long husbandId = createCitizen(officerToken, "REG-920002", "Groom", "Test");
        long wifeId = createCitizen(officerToken, "REG-920003", "Bride", "Test");
        long marriageTypeId = documentTypeIdByCode(officerToken, "MARRIAGE_CERT");

        mockMvc.perform(post("/api/documents/marriage-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"husbandId\":" + husbandId + ",\"wifeId\":" + husbandId
                                + ",\"documentTypeId\":" + marriageTypeId + "}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/documents/marriage-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"husbandId\":" + husbandId + ",\"wifeId\":" + wifeId
                                + ",\"documentTypeId\":" + marriageTypeId + ",\"contractNumber\":\"MC-TEST-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        mockMvc.perform(get("/api/citizens/" + husbandId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.maritalStatus").value("MARRIED"));
        mockMvc.perform(get("/api/citizens/" + wifeId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.maritalStatus").value("MARRIED"));
    }

    @Test
    void divorceCertificateCannotBeIssuedTwiceForTheSameMarriageAndDissolvesIt() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long husbandId = createCitizen(officerToken, "REG-920004", "DivHusband", "Test");
        long wifeId = createCitizen(officerToken, "REG-920005", "DivWife", "Test");
        long marriageTypeId = documentTypeIdByCode(officerToken, "MARRIAGE_CERT");
        long divorceTypeId = documentTypeIdByCode(officerToken, "DIVORCE_CERT");

        MvcResult marriageResult = mockMvc.perform(post("/api/documents/marriage-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"husbandId\":" + husbandId + ",\"wifeId\":" + wifeId
                                + ",\"documentTypeId\":" + marriageTypeId + ",\"contractNumber\":\"MC-TEST-2\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long marriageCertificateId = objectMapper.readTree(marriageResult.getResponse().getContentAsString())
                .get("document").get("id").asLong();

        mockMvc.perform(post("/api/documents/divorce-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"marriageCertificateId\":" + marriageCertificateId + ",\"documentTypeId\":"
                                + divorceTypeId + ",\"divorceType\":\"JUDICIAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // A second divorce against the same marriage is rejected.
        mockMvc.perform(post("/api/documents/divorce-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"marriageCertificateId\":" + marriageCertificateId + ",\"documentTypeId\":"
                                + divorceTypeId + "}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/documents/marriage-certificates/" + marriageCertificateId)
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.status").value("DISSOLVED"));
        mockMvc.perform(get("/api/citizens/" + husbandId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.maritalStatus").value("DIVORCED"));
    }

    @Test
    void deathCertificateMarksTheCitizenDeceased() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-920006", "Deceased", "Test");
        long deathTypeId = documentTypeIdByCode(officerToken, "DEATH_CERT");

        mockMvc.perform(post("/api/documents/death-certificates")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + deathTypeId
                                + ",\"deathDate\":\"2026-01-01\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/citizens/" + citizenId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.deceased").value(true));
    }

    @Test
    void naturalizationRecordUpdatesCitizenNationalityAndNationalIdCardIsListedForTheCitizen() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-920007", "Naturalized", "Test");
        long naturalizationTypeId = documentTypeIdByCode(officerToken, "NATURALIZATION");
        long nationalIdTypeId = documentTypeIdByCode(officerToken, "NATIONAL_ID");

        mockMvc.perform(post("/api/documents/naturalization-records")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + naturalizationTypeId
                                + ",\"decreeNumber\":\"DEC-TEST-1\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/citizens/" + citizenId).header("Authorization", "Bearer " + officerToken))
                .andExpect(jsonPath("$.nationality").value("Lebanese"));

        mockMvc.perform(post("/api/documents/national-id-cards")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + nationalIdTypeId
                                + ",\"cardNumber\":\"ID-TEST-1\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/citizens/" + citizenId + "/national-id-cards")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cardNumber").value("ID-TEST-1"));
    }

    @Test
    void nameChangeRecordCanBeIssuedForACitizen() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-920008", "OldName", "Test");
        long nameChangeTypeId = documentTypeIdByCode(officerToken, "NAME_CHANGE");

        mockMvc.perform(post("/api/documents/name-change-records")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + nameChangeTypeId
                                + ",\"oldFirstName\":\"OldName\",\"newFirstName\":\"NewName\","
                                + "\"reason\":\"Test reason\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newFirstName").value("NewName"));
    }

    @Test
    void issuingAnyDocumentSubtypeIsGatedByCitizenManageButReadsAreNot() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String viewerToken = tokenFor("viewer", "Viewer1234!");
        long citizenId = createCitizen(officerToken, "REG-920009", "Gated", "Test");
        long birthTypeId = documentTypeIdByCode(officerToken, "BIRTH_CERT");

        mockMvc.perform(post("/api/documents/birth-certificates")
                        .header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + birthTypeId + "}"))
                .andExpect(status().isForbidden());

        // Reads in this domain stay open to any authenticated user.
        mockMvc.perform(get("/api/citizens/" + citizenId + "/documents")
                        .header("Authorization", "Bearer " + viewerToken))
                .andExpect(status().isOk());
    }

    // ---- admin-configurable workflow engine ---------------------------------

    @Test
    void workflowEngineExposesTheSeededCatalogMatchingTheRequestWorkflow() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");

        MvcResult statesResult = mockMvc.perform(get("/api/workflow/states")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode states = objectMapper.readTree(statesResult.getResponse().getContentAsString());
        assertThat(states).hasSize(6);
        boolean draftIsSoleInitial = false;
        boolean archivedIsFinal = false;
        for (JsonNode s : states) {
            if (s.get("code").asText().equals("DRAFT")) draftIsSoleInitial = s.get("isInitial").asBoolean();
            if (s.get("code").asText().equals("ARCHIVED")) archivedIsFinal = s.get("isFinal").asBoolean();
        }
        assertThat(draftIsSoleInitial).isTrue();
        assertThat(archivedIsFinal).isTrue();

        MvcResult transitionsResult = mockMvc.perform(get("/api/workflow/transitions")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode transitions = objectMapper.readTree(transitionsResult.getResponse().getContentAsString());
        assertThat(transitions).hasSize(6);
        boolean foundSubmit = false;
        for (JsonNode t : transitions) {
            if (t.get("actionCode").asText().equals("SUBMIT")) {
                foundSubmit = true;
                assertThat(t.get("fromStateCode").asText()).isEqualTo("DRAFT");
                assertThat(t.get("toStateCode").asText()).isEqualTo("SUBMITTED");
                assertThat(t.get("requiredPermissionCodes").get(0).asText())
                        .isEqualTo("REQUEST_TRANSITION_SUBMIT");
            }
        }
        assertThat(foundSubmit).isTrue();
    }

    @Test
    void creatingASecondActiveInitialWorkflowStateIsRejected() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");

        mockMvc.perform(post("/api/workflow/states")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"code\":\"NEW_INITIAL\",\"nameEn\":\"New Initial\",\"isInitial\":true,"
                                + "\"isFinal\":false}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void creatingAWorkflowTransitionWithADuplicateActionCodeIsRejected() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");
        long underReviewId = workflowStateIdByCode(adminToken, "UNDER_REVIEW");
        long approvedId = workflowStateIdByCode(adminToken, "APPROVED");

        // "SUBMIT" is already used by DRAFT->SUBMITTED; action codes are
        // unique system-wide, not per from-state.
        mockMvc.perform(post("/api/workflow/transitions")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"fromStateId\":" + underReviewId + ",\"toStateId\":" + approvedId
                                + ",\"actionCode\":\"SUBMIT\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void workflowInstanceCreationStartsAtTheSoleInitialStateAndRejectsADuplicateForTheSameEntity() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");

        MvcResult result = mockMvc.perform(post("/api/workflow/instances")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"entityType\":\"TEST_SUBJECT\",\"entityId\":9001}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStateCode").value("DRAFT"))
                .andReturn();
        assertThat(result).isNotNull();

        mockMvc.perform(post("/api/workflow/instances")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content("{\"entityType\":\"TEST_SUBJECT\",\"entityId\":9001}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void permissionGatedTransitionsMoveAnInstanceAlongItsConfiguredPathAndRejectUnauthorizedOrUncommentedAttempts()
            throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");

        MvcResult createResult = mockMvc.perform(post("/api/workflow/instances")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"entityType\":\"TEST_SUBJECT\",\"entityId\":9002}"))
                .andExpect(status().isOk())
                .andReturn();
        long instanceId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        // An officer holds REQUEST_TRANSITION_SUBMIT -- SUBMIT succeeds.
        mockMvc.perform(post("/api/workflow/instances/" + instanceId + "/transition")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"actionCode\":\"SUBMIT\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStateCode").value("SUBMITTED"));

        // An officer does NOT hold REQUEST_TRANSITION_REVIEW -- rejected.
        mockMvc.perform(post("/api/workflow/instances/" + instanceId + "/transition")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"actionCode\":\"START_REVIEW\"}"))
                .andExpect(status().isBadRequest());

        // A manager holds REQUEST_TRANSITION_REVIEW -- succeeds.
        mockMvc.perform(post("/api/workflow/instances/" + instanceId + "/transition")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"actionCode\":\"START_REVIEW\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStateCode").value("UNDER_REVIEW"));

        // REJECT requires a comment -- rejected without one, accepted with.
        mockMvc.perform(post("/api/workflow/instances/" + instanceId + "/transition")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"actionCode\":\"REJECT\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/workflow/instances/" + instanceId + "/transition")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"actionCode\":\"REJECT\",\"comment\":\"Missing supporting documents\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStateCode").value("REJECTED"));
    }

    @Test
    void theWorkflowInstanceHistoryRecordsEveryExecutedTransition() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");

        MvcResult createResult = mockMvc.perform(post("/api/workflow/instances")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"entityType\":\"TEST_SUBJECT\",\"entityId\":9003}"))
                .andExpect(status().isOk())
                .andReturn();
        long instanceId = objectMapper.readTree(createResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/workflow/instances/" + instanceId + "/transition")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"actionCode\":\"SUBMIT\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/workflow/instances/" + instanceId + "/history")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fromStateCode").value("DRAFT"))
                .andExpect(jsonPath("$[0].toStateCode").value("SUBMITTED"))
                .andExpect(jsonPath("$[0].actionCode").value("SUBMIT"));
    }

    // ---- full service-request model: SLA records & payments ---------------

    @Test
    void slaRecordTracksTheLiveStatusWhileOpenAndBecomesMetOnceClosedBeforeTheDueDate() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        long citizenId = createCitizen(officerToken, "REG-900101", "Sla", "Open");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        // Freshly created, still open, due date days away -> ON_TRACK, with a
        // days-remaining figure and no overdue/breach figures.
        mockMvc.perform(get("/api/sla-records/" + requestId).header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requestId").value(requestId))
                .andExpect(jsonPath("$.slaStatus").value("ON_TRACK"))
                .andExpect(jsonPath("$.daysRemaining").isNumber())
                .andExpect(jsonPath("$.overdueByDays").doesNotExist());

        // Walk it to ARCHIVED (closed) well before its due date -> MET.
        transition(officerToken, requestId, "SUBMITTED", null).andExpect(status().isOk());
        transition(managerToken, requestId, "UNDER_REVIEW", null).andExpect(status().isOk());
        transition(managerToken, requestId, "APPROVED", null).andExpect(status().isOk());
        transition(officerToken, requestId, "ARCHIVED", null).andExpect(status().isOk());

        mockMvc.perform(post("/api/sla-records/" + requestId + "/refresh").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaStatus").value("MET"))
                .andExpect(jsonPath("$.daysRemaining").doesNotExist())
                .andExpect(jsonPath("$.overdueByDays").doesNotExist());
    }

    @Test
    void listingSlaRecordsByStatusOnlyReturnsRecordsInThatStatus() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900102", "Sla", "List");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        mockMvc.perform(post("/api/sla-records/" + requestId + "/refresh").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/sla-records").queryParam("status", "ON_TRACK")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.requestId == " + requestId + ")]").exists());

        mockMvc.perform(get("/api/sla-records").queryParam("status", "BREACHED")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.requestId == " + requestId + ")]").doesNotExist());
    }

    @Test
    void recordingAPaymentRejectsADuplicateReceiptNumberAcrossRequests() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizen1 = createCitizen(officerToken, "REG-900103", "Pay", "One");
        long citizen2 = createCitizen(officerToken, "REG-900104", "Pay", "Two");
        long request1 = createRequest(officerToken, citizen1, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));
        long request2 = createRequest(officerToken, citizen2, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"requestId\":" + request1 + ",\"amount\":25.00,\"currency\":\"USD\","
                                + "\"method\":\"CASH\",\"receiptNumber\":\"RCPT-TEST-0001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.collectedById").isNumber());

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"requestId\":" + request2 + ",\"amount\":10.00,\"currency\":\"USD\","
                                + "\"method\":\"CASH\",\"receiptNumber\":\"RCPT-TEST-0001\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aWaivedPaymentHasNoCollector() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900105", "Pay", "Waived");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"requestId\":" + requestId + ",\"amount\":15.00,\"currency\":\"USD\",\"method\":\"WAIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.method").value("WAIVED"))
                .andExpect(jsonPath("$.collectedById").doesNotExist());
    }

    @Test
    void reversingAPaymentMarksItReversedAndRejectsBeingReversedTwice() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900106", "Pay", "Reverse");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        MvcResult created = mockMvc.perform(post("/api/payments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"requestId\":" + requestId + ",\"amount\":25.00,\"currency\":\"USD\",\"method\":\"CASH\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long paymentId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/payments/" + paymentId + "/reverse")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"reversalReason\":\"Refunded to citizen in error\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVERSED"))
                .andExpect(jsonPath("$.reversedById").isNumber())
                .andExpect(jsonPath("$.reversalReason").value("Refunded to citizen in error"));

        mockMvc.perform(patch("/api/payments/" + paymentId + "/reverse")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"reversalReason\":\"Trying again\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void paymentsForARequestListsEveryPaymentRecordedAgainstIt() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        long citizenId = createCitizen(officerToken, "REG-900107", "Pay", "List");
        long requestId = createRequest(officerToken, citizenId, firstDocumentTypeId(officerToken), firstOfficeId(officerToken));

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"requestId\":" + requestId + ",\"amount\":25.00,\"currency\":\"USD\",\"method\":\"CASH\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"requestId\":" + requestId + ",\"amount\":5.00,\"currency\":\"USD\",\"method\":\"CHEQUE\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/requests/" + requestId + "/payments").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    // ---- three-tier audit/access logging (tiers 2 & 3) ---------------------

    @Test
    void anApprovedCivilStatusAmendmentWritesAFieldLevelCitizenAuditLogEntry() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long citizenId = createCitizen(officerToken, "REG-920001", "Audit", "Amendment");

        MvcResult result = mockMvc.perform(post("/api/civil-status-amendments")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"fieldChanged\":\"sect\",\"newValue\":\"Druze\","
                                + "\"legalBasis\":\"Court decision 2026-0099\"}"))
                .andExpect(status().isOk())
                .andReturn();
        long amendmentId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/civil-status-amendments/" + amendmentId + "/decide")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/citizen/" + citizenId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fieldName").value("sect"))
                .andExpect(jsonPath("$[0].oldValue").doesNotExist())
                .andExpect(jsonPath("$[0].newValue").value("Druze"))
                .andExpect(jsonPath("$[0].amendmentId").value(amendmentId))
                .andExpect(jsonPath("$[0].reason").value("Court decision 2026-0099"));
    }

    @Test
    void anApprovedRegistryTransferWritesAFieldLevelCitizenAuditLogEntry() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String managerToken = tokenFor("manager", "Manager1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long beirutOfficeId = officeIdByCode(officerToken, "BEY");
        long tripoliOfficeId = officeIdByCode(officerToken, "TRP");
        long citizenId = createCitizenAtOffice(officerToken, "REG-920002", "Audit", "Transfer", beirutOfficeId);

        MvcResult result = mockMvc.perform(post("/api/registry-transfers")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"citizenId\":" + citizenId + ",\"toOfficeId\":" + tripoliOfficeId + "}"))
                .andExpect(status().isOk())
                .andReturn();
        long transferId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/registry-transfers/" + transferId + "/decide")
                        .header("Authorization", "Bearer " + managerToken)
                        .contentType("application/json")
                        .content("{\"decision\":\"APPROVE\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/citizen/" + citizenId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].fieldName").value("registeredOffice"))
                .andExpect(jsonPath("$[0].oldValue").value("BEY"))
                .andExpect(jsonPath("$[0].newValue").value("TRP"))
                .andExpect(jsonPath("$[0].amendmentId").doesNotExist())
                .andExpect(jsonPath("$[0].reason").value("Registry transfer #" + transferId));
    }

    @Test
    void aLineageCorrectionWritesFieldLevelCitizenAuditLogEntriesForBothParents() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long fatherId = createCitizen(officerToken, "REG-920003", "Lineage", "Father");
        long childId = createCitizen(officerToken, "REG-920004", "Lineage", "Child");

        mockMvc.perform(patch("/api/citizens/" + childId + "/lineage")
                        .header("Authorization", "Bearer " + officerToken)
                        .contentType("application/json")
                        .content("{\"fatherId\":" + fatherId + "}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/citizen/" + childId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.fieldName == 'father')].newValue").value("citizen:" + fatherId))
                .andExpect(jsonPath("$[?(@.fieldName == 'mother')]").isEmpty()); // untouched side isn't logged
    }

    @Test
    void viewingASingleCitizenRecordWritesARecordAccessLogEntry() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long citizenId = createCitizen(officerToken, "REG-920005", "Access", "Viewed");

        mockMvc.perform(get("/api/citizens/" + citizenId).queryParam("reason", "Verifying request paperwork")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/access/citizen/" + citizenId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accessType").value("VIEW_RECORD"))
                .andExpect(jsonPath("$[0].reason").value("Verifying request paperwork"))
                .andExpect(jsonPath("$[0].accessedById").isNumber());
    }

    @Test
    void searchingCitizensWritesARecordAccessLogEntryForEachResultReturned() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long citizenId = createCitizen(officerToken, "REG-920006", "Zzsearchable", "Person");

        mockMvc.perform(get("/api/citizens").queryParam("q", "Zzsearchable")
                        .header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/audit/access/citizen/" + citizenId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accessType").value("SEARCH_RESULT"));
    }

    @Test
    void citizenAuditAndAccessLogEndpointsAreGatedByAuditViewPermission() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long citizenId = createCitizen(officerToken, "REG-920007", "Gate", "Check");

        mockMvc.perform(get("/api/audit/citizen/" + citizenId).header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit/citizen/" + citizenId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/access/citizen/" + citizenId).header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit/access/citizen/" + citizenId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ---- session/login hardening as its own domain -------------------------

    @Test
    void aSuccessfulLoginWritesALoginAttemptAndOpensASessionLog() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");
        long officerId = userIdByUsername(adminToken, "officer");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"officer\",\"password\":\"Officer1234!\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/login-attempts").queryParam("username", "officer")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].wasSuccessful").value(true))
                .andExpect(jsonPath("$[0].failureReason").doesNotExist())
                .andExpect(jsonPath("$[0].userId").value(officerId));

        mockMvc.perform(get("/api/audit/sessions/user/" + officerId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].jti").isString())
                .andExpect(jsonPath("$[0].logoutAt").doesNotExist())
                .andExpect(jsonPath("$[0].expiresAt").isString());
    }

    @Test
    void aFailedLoginWithABadPasswordIsRecordedWithThatReason() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"officer\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/audit/login-attempts").queryParam("username", "officer")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].wasSuccessful").value(false))
                .andExpect(jsonPath("$[0].failureReason").value("BAD_PASSWORD"));
    }

    @Test
    void aLoginAttemptAgainstAnUnknownUsernameIsRecordedAsUnknownUser() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"nobody-by-this-name\",\"password\":\"whatever123\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/audit/login-attempts").queryParam("username", "nobody-by-this-name")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].wasSuccessful").value(false))
                .andExpect(jsonPath("$[0].failureReason").value("UNKNOWN_USER"))
                .andExpect(jsonPath("$[0].userId").doesNotExist());
    }

    @Test
    void theLockoutTriggeringLoginAttemptIsRecordedWithReasonAccountLocked() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");
        // Same 5-bad-attempts-then-locked sequence as the existing lockout
        // test, but this time checking what Item 7 records about it.
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                            .contentType("application/json")
                            .content("{\"username\":\"viewer\",\"password\":\"wrong-password\"}"))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"viewer\",\"password\":\"Viewer1234!\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/audit/login-attempts").queryParam("username", "viewer")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath("$[0].failureReason").value("ACCOUNT_LOCKED"))
                .andExpect(jsonPath("$[5].failureReason").value("BAD_PASSWORD")); // oldest of the 6, newest-first order
    }

    @Test
    void loggingOutClosesTheOpenSessionLogEntry() throws Exception {
        String adminToken = tokenFor("admin", "Admin1234!");
        long officerId = userIdByUsername(adminToken, "officer");

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"officer\",\"password\":\"Officer1234!\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode loginJson = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String accessToken = loginJson.get("accessToken").asText();
        String refreshToken = loginJson.get("refreshToken").asText();

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content("{\"refreshToken\":\"" + refreshToken + "\"}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/audit/sessions/user/" + officerId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].logoutAt").isString());
    }

    @Test
    void loginAttemptAndSessionLogEndpointsAreGatedByAuditViewPermission() throws Exception {
        String officerToken = tokenFor("officer", "Officer1234!");
        String adminToken = tokenFor("admin", "Admin1234!");
        long officerId = userIdByUsername(adminToken, "officer");

        mockMvc.perform(get("/api/audit/login-attempts").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit/login-attempts").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/audit/sessions/user/" + officerId).header("Authorization", "Bearer " + officerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit/sessions/user/" + officerId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    // ---- helpers ----------------------------------------------------------

    private long workflowStateIdByCode(String token, String code) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/workflow/states").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode s : objectMapper.readTree(result.getResponse().getContentAsString())) {
            if (s.get("code").asText().equals(code)) return s.get("id").asLong();
        }
        throw new AssertionError("No seeded workflow state with code " + code);
    }

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

    private long userIdByUsername(String token, String username) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode u : objectMapper.readTree(result.getResponse().getContentAsString())) {
            if (u.get("username").asText().equals(username)) return u.get("id").asLong();
        }
        throw new AssertionError("No seeded user with username " + username);
    }

    private long documentTypeIdByCode(String token, String code) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/document-types").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode o : objectMapper.readTree(result.getResponse().getContentAsString())) {
            if (o.get("code").asText().equals(code)) return o.get("id").asLong();
        }
        throw new AssertionError("No seeded document type with code " + code);
    }

    private long officeIdByCode(String token, String code) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/offices").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode o : objectMapper.readTree(result.getResponse().getContentAsString())) {
            if (o.get("code").asText().equals(code)) return o.get("id").asLong();
        }
        throw new AssertionError("No seeded office with code " + code);
    }

    private long firstCourtId(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/courts").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get(0).get("id").asLong();
    }

    private long createCitizenAtOffice(String token, String registryNumber, String first, String last, long officeId)
            throws Exception {
        MvcResult result = mockMvc.perform(post("/api/citizens")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"registryNumber\":\"" + registryNumber + "\",\"firstNameEn\":\"" + first
                                + "\",\"lastNameEn\":\"" + last + "\",\"gender\":\"M\",\"officeId\":" + officeId + "}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createCitizenWithDob(String token, String registryNumber, String first, String last, String dob)
            throws Exception {
        MvcResult result = mockMvc.perform(post("/api/citizens")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"registryNumber\":\"" + registryNumber + "\",\"firstNameEn\":\"" + first
                                + "\",\"lastNameEn\":\"" + last + "\",\"gender\":\"M\",\"dateOfBirth\":\"" + dob + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
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
