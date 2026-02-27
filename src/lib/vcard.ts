export function generateVCard(
  email: string,
  firstName: string,
  lastName: string
): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${lastName};${firstName};;;`,
    `FN:${firstName} ${lastName}`,
    `EMAIL:${email}`,
    "END:VCARD",
  ].join("\n");
}

export function parseVCard(
  raw: string
): { email: string; firstName: string; lastName: string } | null {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (
    !normalized.includes("BEGIN:VCARD") ||
    !normalized.includes("END:VCARD")
  ) {
    return null;
  }

  let email = "";
  let firstName = "";
  let lastName = "";

  const lines = normalized.split("\n");
  for (const line of lines) {
    if (line.startsWith("EMAIL")) {
      // Handle EMAIL:foo@bar.com or EMAIL;type=INTERNET:foo@bar.com
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        email = line.slice(colonIndex + 1).trim();
      }
    } else if (line.startsWith("N:") || line.startsWith("N;")) {
      // N:LastName;FirstName;MiddleName;Prefix;Suffix
      const colonIndex = line.indexOf(":");
      if (colonIndex !== -1) {
        const parts = line.slice(colonIndex + 1).split(";");
        lastName = (parts[0] || "").trim();
        firstName = (parts[1] || "").trim();
      }
    }
  }

  // Fall back to FN if N didn't provide names
  if (!firstName && !lastName) {
    for (const line of lines) {
      if (line.startsWith("FN:") || line.startsWith("FN;")) {
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const fullName = line.slice(colonIndex + 1).trim();
          const parts = fullName.split(" ");
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        }
        break;
      }
    }
  }

  if (!email) return null;

  return { email, firstName, lastName };
}
