// Daftar domain email umum yang diizinkan
const ALLOWED_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.id",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "outlook.co.id",
  "hotmail.com",
  "hotmail.co.id",
  "live.com",
  "live.co.id",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "tutanota.com",
  "zoho.com",
  "fastmail.com",
  "yandex.com",
  "yandex.ru",
]);

// Regex format email yang ketat:
// - Bagian lokal: huruf, angka, titik, underscore, plus, strip
// - Harus ada @ tepat satu kali
// - Domain: huruf, angka, titik, strip
// - TLD minimal 2 karakter
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { valid: false, error: "Email tidak boleh kosong" };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Format email tidak valid" };
  }

  const domain = trimmed.split("@")[1];

  if (!ALLOWED_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: `Domain email "${domain}" tidak diizinkan. Gunakan email dari Gmail, Yahoo, Outlook, iCloud, dll.`,
    };
  }

  return { valid: true };
}
