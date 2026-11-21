import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");

test("public training sessions expose a signed-in learner enrollment form",()=>{
  assert.match(main,/data-training-enroll=/);
  assert.match(main,/training-public-enroll-form/);
  assert.match(main,/Se connecter pour s’inscrire/);
  assert.match(main,/currentSession\.user\.email/);
});

test("enrollment uses the authenticated account email and never asks for another email",()=>{
  assert.match(main,/enrollInTrainingSession\(form\.dataset\.trainingEnroll,participantName,currentSession\.user\.email,participantCategory\)/);
  const catalog=main.slice(main.indexOf("function trainingCatalogView()"),main.indexOf("\nfunction trainingOperationsView("));
  assert.doesNotMatch(catalog,/name="participant_email"/);
});

test("enrollment RPC wrapper calls the database capacity and duplicate-check endpoint",()=>{
  assert.match(data,/academy_enroll_training_session/);
  assert.match(data,/p_session_id: sessionId/);
  assert.match(data,/p_participant_email: participantEmail/);
  assert.match(data,/p_participant_category: participantCategory/);
});

test("registration windows are displayed and remain enforced by the server",()=>{
  assert.match(main,/registration_opens_at/);
  assert.match(main,/registration_closes_at/);
  assert.match(main,/capacité et les délais sont contrôlés par le serveur/);
});
