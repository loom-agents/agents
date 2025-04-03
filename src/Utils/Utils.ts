import crypto from "crypto";

export const v4 = () => {
  const random = crypto.getRandomValues(new Uint8Array(16));
  random[6] = (random[6] & 0x0f) | 0x40; // Set bits 6-7 to version 0100
  random[8] = (random[8] & 0x3f) | 0x80; // Set bits 8-9 to variant 10
  const hexArray = Array.from(random)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return (
    hexArray.slice(0, 8) +
    "-" +
    hexArray.slice(8, 12) +
    "-" +
    hexArray.slice(12, 16) +
    "-" +
    hexArray.slice(16, 20) +
    "-" +
    hexArray.slice(20, 32)
  );
};

export const uuid = (type: string) => {
  const normalizedType = type
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const signed_uuid = `${normalizedType}-${v4()}`;
  return signed_uuid;
};
