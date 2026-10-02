package com.moi.cts.entity;

/**
 * Which way a piece of correspondence crosses the Directorate's boundary
 * (CPP: "registering incoming and outgoing correspondence"). INCOMING is
 * something received -- a citizen's request, a court ruling, another
 * office's letter. OUTGOING is something the Directorate sends -- an issued
 * certificate, a reply, a notice. Defaults to INCOMING, which is what every
 * request created before this field existed was.
 */
public enum CorrespondenceDirection {
    INCOMING,
    OUTGOING
}
