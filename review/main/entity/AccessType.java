package com.moi.cts.entity;

/**
 * The ERD's {@code enum_access_type} for {@link RecordAccessLog}. Only
 * {@code VIEW_RECORD} and {@code SEARCH_RESULT} are currently written by
 * anything in this codebase (see {@code CitizenController}) --
 * {@code VIEW_DOCUMENT} and {@code EXPORT} are defined here to match the
 * ERD faithfully, but nothing wires them up yet: there's no existing
 * "view this citizen's document" or "export these citizen records"
 * endpoint to hang the call on without inventing one, so this is a
 * disclosed gap rather than a silently narrowed enum.
 */
public enum AccessType {
    VIEW_RECORD,
    VIEW_DOCUMENT,
    SEARCH_RESULT,
    EXPORT
}
