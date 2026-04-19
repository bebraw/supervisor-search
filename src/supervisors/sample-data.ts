import { buildSupervisorRecord } from "./parser.ts";
import type { SupervisorRecord } from "./types.ts";

const importedAt = "2026-04-19T00:00:00.000Z";

export const sampleSupervisors: SupervisorRecord[] = [
  buildSupervisorRecord({
    name: "Aino Saarinen",
    topicArea: "Machine learning systems, efficient training pipelines, and LLM evaluation.",
    activeThesisCount: 2,
    rawSource: "Aino Saarinen|Machine learning systems, efficient training pipelines, and LLM evaluation.|2",
    importedAt,
  }),
  buildSupervisorRecord({
    name: "Mikael Lahti",
    topicArea: "Cybersecurity, secure software delivery, and applied cryptography for distributed services.",
    activeThesisCount: 1,
    rawSource: "Mikael Lahti|Cybersecurity, secure software delivery, and applied cryptography for distributed services.|1",
    importedAt,
  }),
  buildSupervisorRecord({
    name: "Leena Heikkila",
    topicArea: "Human-computer interaction, accessibility research, and digital wellbeing in educational tools.",
    activeThesisCount: 4,
    rawSource: "Leena Heikkila|Human-computer interaction, accessibility research, and digital wellbeing in educational tools.|4",
    importedAt,
  }),
  buildSupervisorRecord({
    name: "Tuomas Koski",
    topicArea: "Distributed systems, edge computing, and dependable cloud infrastructure.",
    activeThesisCount: 3,
    rawSource: "Tuomas Koski|Distributed systems, edge computing, and dependable cloud infrastructure.|3",
    importedAt,
  }),
];
