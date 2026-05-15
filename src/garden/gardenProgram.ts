export type GardenProgram = {
  title: string;
  preferPatterns: string[];
  avoidPatterns: string[];
  evolutionPolicy: string[];
};

type Section = "prefer" | "avoid" | "policy" | undefined;

export function parseGardenProgramMarkdown(markdown: string): GardenProgram {
  const program: GardenProgram = {
    title: "Alien Puzzle Garden Program",
    preferPatterns: [],
    avoidPatterns: [],
    evolutionPolicy: []
  };
  let section: Section;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("# ")) {
      program.title = line.replace(/^#\s+/, "").trim();
      section = undefined;
      continue;
    }
    if (/^prefer patterns that:?$/i.test(line)) {
      section = "prefer";
      continue;
    }
    if (/^avoid:?$/i.test(line)) {
      section = "avoid";
      continue;
    }
    if (/^##\s+evolution policy/i.test(line)) {
      section = "policy";
      continue;
    }
    if (line.startsWith("## ")) {
      section = undefined;
      continue;
    }

    const listItem = line.match(/^[-*]\s+(.+)$/)?.[1]?.trim();
    if (!listItem || !section) {
      continue;
    }
    if (section === "prefer") {
      program.preferPatterns.push(listItem);
    } else if (section === "avoid") {
      program.avoidPatterns.push(listItem);
    } else {
      program.evolutionPolicy.push(listItem);
    }
  }

  return program;
}

export function renderGardenStatus(program: GardenProgram): string {
  return `${program.title}

Current garden policy:

Prefer patterns:
${formatList(program.preferPatterns)}

Avoid:
${formatList(program.avoidPatterns)}

Evolution policy:
${formatList(program.evolutionPolicy)}

Observatory note:
This program is guidance for future garden evolution, not a proof rule or automatic override.
`;
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none specified";
}
