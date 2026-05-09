import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(d: Date | string, locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDate(d: Date | string, locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    typeof d === "string" ? new Date(d) : d,
  );
}

export function formatTimeRange(
  start: Date | string,
  end: Date | string,
  locale = "zh-CN",
) {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const dt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const t = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  if (sameDay) return `${dt.format(s)} – ${t.format(e)}`;
  return `${dt.format(s)} – ${dt.format(e)}`;
}

export function relativeTime(d: Date | string, locale = "zh-CN") {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = (date.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const ranges: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, sec] of ranges) {
    if (Math.abs(diff) >= sec || unit === "second") {
      return rtf.format(Math.round(diff / sec), unit);
    }
  }
  return "";
}

// ASCII-only slug. Non-ASCII titles fall back to a short random code so that
// URL paths never need percent-encoding (which has burned us with Next.js
// route param decoding inconsistencies).
export function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (ascii.length >= 2) return ascii;
  return `e-${randomCode(8).toLowerCase()}`;
}

export function randomCode(len = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
