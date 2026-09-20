package com.moi.cts.entity;

/** The ERD's {@code enum_login_failure}, for {@link LoginAttempt#getFailureReason()}. Null on a successful attempt. */
public enum LoginFailureReason {
    UNKNOWN_USER,
    BAD_PASSWORD,
    ACCOUNT_LOCKED,
    ACCOUNT_INACTIVE
}
