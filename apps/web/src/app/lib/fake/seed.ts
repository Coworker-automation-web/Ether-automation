import type { MeResponse, Snapshot } from "@ether/shared";
import type { DocNode } from "../contracts";

export interface MockSnapshot extends Snapshot {
  readonly content: DocNode;
}

// Tiny builders so seed documents are plain JSON nodes, never HTML strings.
const text = (value: string, bold = false): DocNode =>
  bold ? { type: "text", text: value, marks: [{ type: "bold" }] } : { type: "text", text: value };
const para = (...parts: (string | DocNode)[]): DocNode => ({
  type: "paragraph",
  content: parts.map((p) => (typeof p === "string" ? text(p) : p)),
});
const h2 = (value: string): DocNode => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
const h3 = (value: string): DocNode => ({ type: "heading", attrs: { level: 3 }, content: [text(value)] });
const bullets = (...items: DocNode[][]): DocNode => ({
  type: "bulletList",
  content: items.map((content) => ({ type: "listItem", content: [{ type: "paragraph", content }] })),
});
const item = (label: string, rest: string): DocNode[] => [text(label, true), text(` ${rest}`)];
const plainItem = (value: string): DocNode[] => [text(value)];
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });

export const EMPTY_DOC: DocNode = { type: "doc", content: [{ type: "paragraph" }] };

interface Seed {
  readonly title: string;
  readonly ageSeconds: number;
  readonly content: DocNode;
}

// The prototype's seven history records and their documents.
const SEEDS: readonly Seed[] = [
  {
    title: "AI Productivity Tips",
    ageSeconds: 2 * 60,
    content: doc(
      h2("AI Productivity Tips & Workflows"),
      para("A strategic playbook for accelerating creative and analytical output using ambient agents."),
      h3("1. Structured Workspace Prompts"),
      para("Establish persistent context by defining system prompts and workspace guidelines upfront."),
      h3("2. Multi-Agent Orchestration"),
      para("Delegate specialized research, drafting, and verification tasks across focused agents."),
      h3("3. Real-Time Canvas Co-Authoring"),
      para("Iterate directly on documents with instant AI inline suggestions and automatic version summaries."),
    ),
  },
  {
    title: "Project Ethia – Planning",
    ageSeconds: 12 * 60,
    content: doc(
      h2("Project Ethia – Master Planning & Milestones"),
      para("Strategic roadmap for the Ethia platform release across Q1 and Q2."),
      h3("Core Deliverables"),
      bullets(
        item("Architecture:", "Distributed node network with 99.99% uptime target"),
        item("Interface:", "Editorial warm-beige design system (Playfair + Inter)"),
        item("Data Security:", "End-to-end client key encryption for Gemini models"),
      ),
    ),
  },
  {
    title: "Web Design Ideas",
    ageSeconds: 60 * 60,
    content: doc(
      h2("Editorial Web Design Concepts"),
      para("Exploration of organic, warm-minimalism aesthetics replacing sterile corporate templates."),
      bullets(
        plainItem("Warm oatmeal & espresso color palettes with tactile drop shadows"),
        plainItem("High-contrast serif headings paired with clean geometric body text"),
        plainItem("Clay/3D subtle visual elements with smooth physical lighting"),
      ),
    ),
  },
  {
    title: "Study Plan – Class 9",
    ageSeconds: 2 * 3600,
    content: doc(
      h2("Class 9 Academic Curriculum Study Plan"),
      para("Structured 12-week revision and mastery schedule."),
      h3("Weekly Cadence"),
      bullets(
        item("Mathematics:", "Quadratic equations & geometric theorems (Mon/Wed)"),
        item("Sciences:", "Physics motion laws and organic chemistry foundations (Tue/Thu)"),
        item("Literature:", "Analytical essays and reading comprehension (Fri)"),
      ),
    ),
  },
  {
    title: "Future City Concept",
    ageSeconds: 3 * 3600,
    content: doc(
      h2("Future City Concept – Biophilic Urban Architecture"),
      para("A vision document exploring self-sustaining urban micro-clusters by 2045."),
      h3("Pillars of Design"),
      bullets(
        plainItem("Modular solar-canopy skyways connecting elevated pedestrian plazas"),
        plainItem("Vertical hydroponic farming integrated into residential facades"),
        plainItem("Closed-loop rainwater harvesting and decentralized geothermal cooling"),
      ),
    ),
  },
  {
    title: "Metse App Features",
    ageSeconds: 86400 + 3600,
    content: doc(
      h2("Metse App – Feature Roadmap & User Stories"),
      para("Core capabilities planned for the mobile application beta launch."),
      bullets(
        item("Instant Synchronization:", "Offline-first CRDT document sync"),
        item("Smart Voice Notes:", "On-device transcription with automatic chaptering"),
        item("Collaborative Canvases:", "Multi-user shared boards with presence badges"),
      ),
    ),
  },
  {
    title: "Fitness Routine",
    ageSeconds: 86400 + 5 * 3600,
    content: doc(
      h2("Weekly Athletic Performance Routine"),
      para("Periodized strength, cardiovascular endurance, and recovery protocol."),
      bullets(
        item("Day 1:", "Lower body power & posterior chain development"),
        item("Day 2:", "Zone 2 aerobic base conditioning (45 min)"),
        item("Day 3:", "Upper body hypertrophy & scapular stability"),
        item("Day 4:", "Active mobility, sauna, and restorative stretching"),
      ),
    ),
  },
];

export function seedSnapshots(nowSec: number): MockSnapshot[] {
  return SEEDS.map((s, i) => ({
    id: `seed-${i + 1}`,
    kind: "named",
    title: s.title,
    summary: `Summary of “${s.title}”.`,
    summary_status: "done",
    bytes: JSON.stringify(s.content).length,
    created_at: nowSec - s.ageSeconds,
    content: s.content,
  }));
}

/** The signed-in user the mock serves from GET /api/me. Admin, so every part of the UI can be exercised. */
export const MOCK_ME: MeResponse = {
  user: { id: "user-demo", email: "veronica@example.com", name: "Veronica", picture: null },
  memberships: [
    {
      orgId: "org-demo",
      orgName: "Ether Demo",
      role: "admin",
      publicWorkspaceId: "ws-public-demo",
      aiKeyDelegated: false,
    },
  ],
};
