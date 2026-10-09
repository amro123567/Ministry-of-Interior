package com.moi.cts;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Deactivating an account must take effect at once and must not lock everyone out. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserDeactivationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    private JsonNode login(String username, String password) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/auth/login").contentType("application/json")
                        .content("{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString());
    }

    private long userId(String adminToken, String username) throws Exception {
        MvcResult r = mockMvc.perform(get("/api/users").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode u : objectMapper.readTree(r.getResponse().getContentAsString())) {
            if (username.equals(u.get("username").asText())) return u.get("id").asLong();
        }
        throw new AssertionError("no such user " + username);
    }

    private void setEnabled(String token, long id, boolean enabled, int expectedStatus) throws Exception {
        mockMvc.perform(patch("/api/users/" + id + "/enabled").header("Authorization", "Bearer " + token)
                        .contentType("application/json").content("{\"enabled\":" + enabled + "}"))
                .andExpect(status().is(expectedStatus));
    }

    @Test
    void deactivatedUserCannotLogInRefreshOrUseAnExistingToken() throws Exception {
        String admin = login("admin", "Admin1234!").get("accessToken").asText();
        JsonNode officerSession = login("officer", "Officer1234!");
        String officerToken = officerSession.get("accessToken").asText();
        String officerRefresh = officerSession.get("refreshToken").asText();
        long officerId = userId(admin, "officer");

        mockMvc.perform(get("/api/requests").header("Authorization", "Bearer " + officerToken)).andExpect(status().isOk());

        mockMvc.perform(patch("/api/users/" + officerId + "/enabled").header("Authorization", "Bearer " + admin)
                        .contentType("application/json").content("{\"enabled\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));

        // the token the officer already held stops working immediately
        mockMvc.perform(get("/api/requests").header("Authorization", "Bearer " + officerToken))
                .andExpect(status().is4xxClientError());
        mockMvc.perform(post("/api/auth/login").contentType("application/json")
                        .content("{\"username\":\"officer\",\"password\":\"Officer1234!\"}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/refresh").contentType("application/json")
                        .content("{\"refreshToken\":\"" + officerRefresh + "\"}"))
                .andExpect(status().isUnauthorized());

        // and reactivating restores access
        setEnabled(admin, officerId, true, 200);
        login("officer", "Officer1234!");
    }

    @Test
    void anAdministratorCannotDeactivateThemselves() throws Exception {
        String admin = login("admin", "Admin1234!").get("accessToken").asText();
        mockMvc.perform(patch("/api/users/" + userId(admin, "admin") + "/enabled").header("Authorization", "Bearer " + admin)
                        .contentType("application/json").content("{\"enabled\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("own account")));
    }

    @Test
    void onlyUserManagersMayChangeAccountStatus() throws Exception {
        String admin = login("admin", "Admin1234!").get("accessToken").asText();
        long viewerId = userId(admin, "viewer");
        for (String[] who : new String[][] {{"manager", "Manager1234!"}, {"officer", "Officer1234!"}, {"viewer", "Viewer1234!"}}) {
            String token = login(who[0], who[1]).get("accessToken").asText();
            setEnabled(token, viewerId, false, 403);
        }
    }

    @Test
    void theStatusChangeIsWrittenToTheAuditLog() throws Exception {
        String admin = login("admin", "Admin1234!").get("accessToken").asText();
        long viewerId = userId(admin, "viewer");
        setEnabled(admin, viewerId, false, 200);

        mockMvc.perform(get("/api/audit").param("action", "USER_DISABLED").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].action").value("USER_DISABLED"))
                .andExpect(jsonPath("$[0].details").value("viewer"));
    }

    @Test
    void auditSearchAndExportHonourTheSameFilters() throws Exception {
        String admin = login("admin", "Admin1234!").get("accessToken").asText();
        setEnabled(admin, userId(admin, "viewer"), false, 200);

        mockMvc.perform(get("/api/audit").param("q", "viewer").param("action", "USER_DISABLED")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get("/api/audit").param("q", "no-such-text-anywhere").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/audit/export").param("action", "USER_DISABLED").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("\"USER_DISABLED\"")))
                .andExpect(content().string(containsString("Timestamp,Action,EntityType,EntityId,Actor,Details")));

        String officer = login("officer", "Officer1234!").get("accessToken").asText();
        mockMvc.perform(get("/api/audit/export").header("Authorization", "Bearer " + officer)).andExpect(status().isForbidden());
    }

    @Test
    void reportsAcceptADateRangeAndExportCsv() throws Exception {
        String admin = login("admin", "Admin1234!").get("accessToken").asText();

        // a range entirely in the past contains no requests
        mockMvc.perform(get("/api/reports/summary").param("from", "2000-01-01").param("to", "2000-01-31")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.byOffice.length()").value(0))
                .andExpect(jsonPath("$.throughput.length()").value(8));

        mockMvc.perform(get("/api/reports/export").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Section,Label,Metric,Value")))
                .andExpect(content().string(containsString("\"Sla\",\"all\",\"breachRatePercent\"")));

        String viewer = login("viewer", "Viewer1234!").get("accessToken").asText();
        mockMvc.perform(get("/api/reports/export").header("Authorization", "Bearer " + viewer)).andExpect(status().isForbidden());
    }

    @Test
    void csvCellsAreDefusedAgainstSpreadsheetFormulas() throws Exception {
        java.lang.reflect.Method cell = Class.forName("com.moi.cts.service.CsvCells").getDeclaredMethod("cell", String.class);
        cell.setAccessible(true);
        org.assertj.core.api.Assertions.assertThat(cell.invoke(null, "=HYPERLINK(\"x\")")).isEqualTo("\"'=HYPERLINK(\"\"x\"\")\"");
        org.assertj.core.api.Assertions.assertThat(cell.invoke(null, "plain")).isEqualTo("\"plain\"");
        org.assertj.core.api.Assertions.assertThat(cell.invoke(null, (String) null)).isEqualTo("\"\"");
    }
}
