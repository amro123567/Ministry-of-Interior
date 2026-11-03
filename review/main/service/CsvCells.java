package com.moi.cts.service;

/** Quoting for CSV cells that also defuses spreadsheet formula injection. */
final class CsvCells {

    private CsvCells() {}

    /**
     * Quotes the value and, when it starts with a character a spreadsheet would
     * treat as a formula (= + - @, tab or carriage return), prefixes an apostrophe
     * so Excel/Sheets show it as plain text instead of running it.
     */
    static String cell(String value) {
        String v = value == null ? "" : value;
        if (!v.isEmpty() && "=+-@\t\r".indexOf(v.charAt(0)) >= 0) v = "'" + v;
        return "\"" + v.replace("\"", "\"\"") + "\"";
    }
}
