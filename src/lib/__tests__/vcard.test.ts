import { describe, it, expect } from "vitest";
import { generateVCard, parseVCard } from "../vcard";

describe("generateVCard", () => {
  it("generates valid VCard 3.0 format", () => {
    const result = generateVCard("john@example.com", "John", "Doe");
    expect(result).toContain("BEGIN:VCARD");
    expect(result).toContain("VERSION:3.0");
    expect(result).toContain("N:Doe;John;;;");
    expect(result).toContain("FN:John Doe");
    expect(result).toContain("EMAIL:john@example.com");
    expect(result).toContain("END:VCARD");
  });

  it("handles empty names", () => {
    const result = generateVCard("test@example.com", "", "");
    expect(result).toContain("N:;;;;");
    expect(result).toContain("FN: ");
    expect(result).toContain("EMAIL:test@example.com");
  });
});

describe("parseVCard", () => {
  it("parses a standard VCard", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Doe;John;;;",
      "FN:John Doe",
      "EMAIL:john@example.com",
      "END:VCARD",
    ].join("\n");

    const result = parseVCard(vcard);
    expect(result).toEqual({
      email: "john@example.com",
      firstName: "John",
      lastName: "Doe",
    });
  });

  it("handles \\r\\n line endings", () => {
    const vcard = "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Smith;Jane;;;\r\nEMAIL:jane@test.com\r\nEND:VCARD";
    const result = parseVCard(vcard);
    expect(result).toEqual({
      email: "jane@test.com",
      firstName: "Jane",
      lastName: "Smith",
    });
  });

  it("handles EMAIL with type parameter", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Doe;John;;;",
      "EMAIL;type=INTERNET:john@example.com",
      "END:VCARD",
    ].join("\n");

    const result = parseVCard(vcard);
    expect(result?.email).toBe("john@example.com");
  });

  it("falls back to FN when N has no names", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:;;;;",
      "FN:Jane Smith",
      "EMAIL:jane@test.com",
      "END:VCARD",
    ].join("\n");

    const result = parseVCard(vcard);
    expect(result).toEqual({
      email: "jane@test.com",
      firstName: "Jane",
      lastName: "Smith",
    });
  });

  it("returns null for invalid VCard (no BEGIN/END)", () => {
    expect(parseVCard("not a vcard")).toBeNull();
  });

  it("returns null when no email is present", () => {
    const vcard = "BEGIN:VCARD\nVERSION:3.0\nN:Doe;John;;;\nEND:VCARD";
    expect(parseVCard(vcard)).toBeNull();
  });

  it("round-trips with generateVCard", () => {
    const generated = generateVCard("test@example.com", "Alice", "Wonder");
    const parsed = parseVCard(generated);
    expect(parsed).toEqual({
      email: "test@example.com",
      firstName: "Alice",
      lastName: "Wonder",
    });
  });
});
