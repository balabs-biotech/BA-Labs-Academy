import test from "node:test";
import assert from "node:assert/strict";
import { calculateExpiry, normalizeAuthError } from "../src/core/auth.js";

test("session expiry uses seconds and an injectable clock", () => {
  assert.equal(calculateExpiry(3600, 1_000_000), 4600);
});

test("session expiry clamps invalid durations to zero", () => {
  assert.equal(calculateExpiry(-10, 1_000_000), 1000);
  assert.equal(calculateExpiry("invalid", 1_000_000), 1000);
});

test("auth errors prefer the provider message", () => {
  assert.equal(normalizeAuthError({ msg: "Compte non confirmé" }), "Compte non confirmé");
  assert.equal(normalizeAuthError({ error_description: "Identifiants invalides" }), "Identifiants invalides");
});

test("auth errors have a stable fallback", () => {
  assert.equal(normalizeAuthError({}), "Échec de l’authentification.");
});
