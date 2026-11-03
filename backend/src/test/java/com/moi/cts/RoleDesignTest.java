package com.moi.cts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.RoleName;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.RoleRepository;
import com.moi.cts.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The role design and the fixes made after the system review:
 *
 *   OFFICER  prepares the case   : register citizens, create/edit drafts, submit, take payments
 *   MANAGER  distributes+decides : assign, start review, approve/reject, decide registry changes
 *   ADMIN    runs the system and closes the case: ARCHIVE, reverse payments, users, audit, reports,
 *            plus an emergency override on assign / review / decide
 *   VIEWER   read-only
 *
 * and "whoever submitted a request cannot review or decide it" (four-eyes).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RoleDesignTest {

    /** The signing secret in application-test.yml (needed to build an already-expired token). */
    private static final String TEST_JWT_SECRET = "test-only-secret-not-for-production-use-32bytes+";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired CorrespondenceRequestRepository requestRepository;
    @Autowired AppUserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private int registrySeq = 0;

    // ---- the permission matrix -------------------------------------------------

    @Test
    void eachRoleGetsExactlyItsDesignedPermissions() throws Exception {
        assertThat(permissionsOf("admin", "Admin1234!")).containsExactlyInAnyOrder(
                "USER_VIEW", "USER_MANAGE", "AUDIT_VIEW", "REPORTS_VIEW", "REQUEST_ASSIGN",
                "REQUEST_TRANSITION_REVIEW", "REQUEST_TRANSITION_DECIDE", "REQUEST_TRANSITION_ARCHIVE",
                "PAYMENT_REVERSE");
        assertThat(permissionsOf("manager", "Manager1234!")).containsExactlyInAnyOrder(
                "USER_VIEW", "REPORTS_VIEW", "REQUEST_ASSIGN", "REQUEST_TRANSITION_REVIEW",
                "REQUEST_TRANSITION_DECIDE", "CITIZEN_REGISTRY_DECIDE");
        assertThat(permissionsOf("officer", "Officer1234!")).containsExactlyInAnyOrder(
                "REQUEST_CREATE", "REQUEST_TRANSITION_SUBMIT", "CITIZEN_MANAGE", "PAYMENT_RECORD");
        assertThat(permissionsOf("viewer", "Viewer1234!")).isEmpty();
    }

    // ---- who may create and who may assign ------------------------------------

    @Test
    void onlyTheOfficerCreatesRequestsAndOnlyManagerAndAdminAssignThem() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        String manager = tokenFor("manager", "Manager1234!");
        String admin = tokenFor("admin", "Admin1234!");
        long citizenId = createCitizen(officer);
        long docType = firstId(officer, "/api/document-types");
        long office = firstId(officer, "/api/offices");
        String body = "{\"citizenId\":" + citizenId + ",\"documentTypeId\":" + docType + ",\"officeId\":" + office + "}";

        // Reviewing and deciding do not include creating a request.
        for (String token : new String[] {manager, admin}) {
            mockMvc.perform(post("/api/requests").header("Authorization", "Bearer " + token)
                            .contentType("application/json").content(body))
                    .andExpect(status().isForbidden());
        }
        long requestId = createRequest(officer, citizenId, docType, office);

        // Preparing the case does not include handing out work.
        long officerId = userId(admin, "officer");
        String assign = "{\"userId\":" + officerId + "}";
        mockMvc.perform(patch("/api/requests/" + requestId + "/assign").header("Authorization", "Bearer " + officer)
                        .contentType("application/json").content(assign))
                .andExpect(status().isForbidden());
        for (String token : new String[] {manager, admin}) {
            mockMvc.perform(patch("/api/requests/" + requestId + "/assign").header("Authorization", "Bearer " + token)
                            .contentType("application/json").content(assign))
                    .andExpect(status().isOk());
        }
    }

    // ---- who may submit, decide and archive -----------------------------------

    @Test
    void onlyTheOfficerSubmitsAndOnlyTheAdminArchives() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        String manager = tokenFor("manager", "Manager1234!");
        String admin = tokenFor("admin", "Admin1234!");
        long requestId = newDraft(officer);

        // Submitting belongs to the officer who prepared it.
        transition(manager, requestId, "SUBMITTED").andExpect(status().isBadRequest());
        transition(admin, requestId, "SUBMITTED").andExpect(status().isBadRequest());
        transition(officer, requestId, "SUBMITTED").andExpect(status().isOk());

        transition(manager, requestId, "UNDER_REVIEW").andExpect(status().isOk());
        transition(manager, requestId, "APPROVED").andExpect(status().isOk());

        // Archiving is the last step of the path: not the officer's, not the manager's.
        transition(officer, requestId, "ARCHIVED").andExpect(status().isBadRequest());
        transition(manager, requestId, "ARCHIVED").andExpect(status().isBadRequest());
        transition(admin, requestId, "ARCHIVED").andExpect(status().isOk());
    }

    @Test
    void theAdminCanStepInToReviewAndDecideWhenTheManagerIsAway() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        String admin = tokenFor("admin", "Admin1234!");
        long requestId = newDraft(officer);
        transition(officer, requestId, "SUBMITTED").andExpect(status().isOk());

        transition(admin, requestId, "UNDER_REVIEW").andExpect(status().isOk());
        transition(admin, requestId, "APPROVED").andExpect(status().isOk());
    }

    // ---- four-eyes -------------------------------------------------------------

    @Test
    void aSubmitterCannotReviewOrDecideTheirOwnRequestAndIsNotOfferedTheMoves() throws Exception {
        String manager = tokenFor("manager", "Manager1234!");
        String dual = tokenForDualRoleUser("dual.submitter");
        long citizenId = createCitizen(dual);
        long requestId = createRequest(dual, citizenId, firstId(dual, "/api/document-types"), firstId(dual, "/api/offices"));
        transition(dual, requestId, "SUBMITTED").andExpect(status().isOk());

        // The server refuses it...
        transition(dual, requestId, "UNDER_REVIEW")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("submitted this request")));

        // ...the screen is not offered it...
        mockMvc.perform(get("/api/requests/" + requestId + "/transitions").header("Authorization", "Bearer " + dual))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.toStatus == 'UNDER_REVIEW')]").isEmpty());

        // ...while a different user is offered it and can do it.
        mockMvc.perform(get("/api/requests/" + requestId + "/transitions").header("Authorization", "Bearer " + manager))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.toStatus == 'UNDER_REVIEW')]").isNotEmpty());
        transition(manager, requestId, "UNDER_REVIEW").andExpect(status().isOk());
        transition(dual, requestId, "APPROVED").andExpect(status().isBadRequest());
        transition(manager, requestId, "APPROVED").andExpect(status().isOk());
    }

    // ---- 401 versus 403 ---------------------------------------------------------

    @Test
    void aMissingInvalidOrExpiredTokenGets401WhileAMissingPermissionStill403s() throws Exception {
        mockMvc.perform(get("/api/requests")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/requests").header("Authorization", "Bearer not-a-real-token"))
                .andExpect(status().isUnauthorized());

        // A properly signed token that expired a few minutes ago: what the browser holds after 30 minutes.
        String expired = new JwtService(TEST_JWT_SECRET, -5, 7).generateAccessToken("officer", List.of("OFFICER"));
        mockMvc.perform(get("/api/requests").header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized());

        // Signed in but not allowed is still 403.
        mockMvc.perform(post("/api/requests").header("Authorization", "Bearer " + tokenFor("viewer", "Viewer1234!"))
                        .contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }

    // ---- SLA clock and close time ----------------------------------------------

    @Test
    void archivingKeepsTheTimeTheRequestWasDecidedAndTheSlaStaysMet() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        String manager = tokenFor("manager", "Manager1234!");
        String admin = tokenFor("admin", "Admin1234!");
        long requestId = newDraft(officer);
        transition(officer, requestId, "SUBMITTED").andExpect(status().isOk());
        transition(manager, requestId, "UNDER_REVIEW").andExpect(status().isOk());
        transition(manager, requestId, "APPROVED").andExpect(status().isOk());
        String closedWhenDecided = getJson(officer, "/api/requests/" + requestId).get("closedAt").asText();

        transition(admin, requestId, "ARCHIVED").andExpect(status().isOk());

        assertThat(getJson(officer, "/api/requests/" + requestId).get("closedAt").asText())
                .as("archiving must not move the close time")
                .isEqualTo(closedWhenDecided);
        mockMvc.perform(post("/api/sla-records/" + requestId + "/refresh").header("Authorization", "Bearer " + officer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slaStatus").value("MET"));
    }

    @Test
    void theSlaClockStartsWhenTheRequestIsSubmittedNotWhenTheDraftWasCreated() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        long requestId = newDraft(officer);

        // A draft that has been sitting for ten days: its creation-time due date is long gone.
        CorrespondenceRequest draft = requestRepository.findById(requestId).orElseThrow();
        draft.setDueAt(Instant.now().minus(10, ChronoUnit.DAYS));
        requestRepository.saveAndFlush(draft);

        transition(officer, requestId, "SUBMITTED").andExpect(status().isOk());

        mockMvc.perform(get("/api/requests/" + requestId).header("Authorization", "Bearer " + officer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.overdue").value(false))
                .andExpect(jsonPath("$.slaStatus").value(org.hamcrest.Matchers.not("OVERDUE")));
    }

    // ---- who can be given work -------------------------------------------------

    @Test
    void workCanOnlyBeAssignedToActiveStaffWhoCanWorkRequests() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        String manager = tokenFor("manager", "Manager1234!");
        String admin = tokenFor("admin", "Admin1234!");
        long requestId = newDraft(officer);
        long viewerId = userId(admin, "viewer");
        long officerId = userId(admin, "officer");

        // A read-only viewer cannot act on a request, so cannot be assigned one.
        mockMvc.perform(patch("/api/requests/" + requestId + "/assign").header("Authorization", "Bearer " + manager)
                        .contentType("application/json").content("{\"userId\":" + viewerId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("cannot be assigned")));

        // An active officer can.
        mockMvc.perform(patch("/api/requests/" + requestId + "/assign").header("Authorization", "Bearer " + manager)
                        .contentType("application/json").content("{\"userId\":" + officerId + "}"))
                .andExpect(status().isOk());

        // Once deactivated, they cannot be given more work.
        mockMvc.perform(patch("/api/users/" + officerId + "/enabled").header("Authorization", "Bearer " + admin)
                        .contentType("application/json").content("{\"enabled\":false}"))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/requests/" + requestId + "/assign").header("Authorization", "Bearer " + manager)
                        .contentType("application/json").content("{\"userId\":" + officerId + "}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("deactivated")));
    }

    // ---- notifications ---------------------------------------------------------

    @Test
    void onlyTheRecipientCanMarkANotificationAsRead() throws Exception {
        String officer = tokenFor("officer", "Officer1234!");
        String manager = tokenFor("manager", "Manager1234!");
        String admin = tokenFor("admin", "Admin1234!");
        long requestId = newDraft(officer);
        mockMvc.perform(patch("/api/requests/" + requestId + "/assign").header("Authorization", "Bearer " + manager)
                        .contentType("application/json").content("{\"userId\":" + userId(admin, "officer") + "}"))
                .andExpect(status().isOk());

        long notificationId = getJson(officer, "/api/notifications").get(0).get("id").asLong();

        // Someone else cannot touch it (and cannot learn that it exists).
        mockMvc.perform(patch("/api/notifications/" + notificationId + "/read").header("Authorization", "Bearer " + manager))
                .andExpect(status().isNotFound());

        mockMvc.perform(patch("/api/notifications/" + notificationId + "/read").header("Authorization", "Bearer " + officer))
                .andExpect(status().isOk());
        boolean read = false;
        for (JsonNode n : getJson(officer, "/api/notifications")) {
            if (n.get("id").asLong() == notificationId) read = n.get("read").asBoolean();
        }
        assertThat(read).isTrue();
    }

    // ---- startup safety --------------------------------------------------------

    @Test
    void aWeakOrPlaceholderJwtSecretIsRefused() {
        assertThrows(IllegalStateException.class, () -> new JwtService("too-short", 30, 7));
        assertThrows(IllegalStateException.class,
                () -> new JwtService("change-this-in-.env-to-a-long-random-string-before-running", 30, 7));
        assertThrows(IllegalStateException.class,
                () -> new JwtService("generate-a-long-random-string-padded-to-32-chars-or-more", 30, 7));
        // A real random value of sufficient length is accepted.
        new JwtService("q7Zp1xW9sT3vB6nK2mR8yH4cD0fG5jL1aE7uI9oP3tY=", 30, 7);
    }

    // ---- helpers ---------------------------------------------------------------

    private String tokenFor(String username, String password) throws Exception {
        return login(username, password).get("accessToken").asText();
    }

    private Set<String> permissionsOf(String username, String password) throws Exception {
        Set<String> out = new HashSet<>();
        login(username, password).get("permissions").forEach(p -> out.add(p.asText()));
        return out;
    }

    private JsonNode login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /** A test-only account holding BOTH the OFFICER and MANAGER roles, used to reach the "same person" rules. */
    private String tokenForDualRoleUser(String username) throws Exception {
        AppUser u = new AppUser();
        u.setUsername(username);
        u.setPasswordHash(passwordEncoder.encode("Dual1234!"));
        u.setFullName("Dual Role " + username);
        u.setEmail(username + "@moi.gov.lb");
        u.setRoles(new HashSet<>(List.of(
                roleRepository.findByName(RoleName.OFFICER).orElseThrow(),
                roleRepository.findByName(RoleName.MANAGER).orElseThrow())));
        userRepository.save(u);
        return tokenFor(username, "Dual1234!");
    }

    private JsonNode getJson(String token, String url) throws Exception {
        MvcResult result = mockMvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private long firstId(String token, String url) throws Exception {
        return getJson(token, url).get(0).get("id").asLong();
    }

    private long userId(String token, String username) throws Exception {
        for (JsonNode u : getJson(token, "/api/users")) {
            if (u.get("username").asText().equals(username)) return u.get("id").asLong();
        }
        throw new AssertionError("No seeded user with username " + username);
    }

    private long createCitizen(String token) throws Exception {
        String registry = "REG-RD-" + (++registrySeq) + "-" + System.nanoTime() % 1_000_000;
        MvcResult result = mockMvc.perform(post("/api/citizens")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content("{\"registryNumber\":\"" + registry + "\",\"firstNameEn\":\"Role\","
                                + "\"lastNameEn\":\"Design\",\"gender\":\"M\"}"))
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

    /** A fresh DRAFT created by the officer. */
    private long newDraft(String officerToken) throws Exception {
        long citizenId = createCitizen(officerToken);
        return createRequest(officerToken, citizenId, firstId(officerToken, "/api/document-types"),
                firstId(officerToken, "/api/offices"));
    }

    private ResultActions transition(String token, long requestId, String toStatus) throws Exception {
        return mockMvc.perform(patch("/api/requests/" + requestId + "/transition")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content("{\"toStatus\":\"" + toStatus + "\"}"));
    }
}
