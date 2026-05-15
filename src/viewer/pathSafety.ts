import { isAbsolute, join, normalize, resolve, sep } from "node:path";

const ALLOWED_ROOTS = ["experiments", "docs"];

export function resolveAllowedViewerPath(rootDir: string, requestedPath: string): string {
  const normalizedInput = requestedPath.replaceAll("\\", "/");
  if (!normalizedInput || normalizedInput.includes("\0") || normalizedInput.includes("..") || isAbsolute(normalizedInput) || /^[A-Za-z]:/.test(normalizedInput)) {
    throw new Error("Viewer file path is not allowed.");
  }

  if (!isAllowedRelativePath(normalizedInput)) {
    throw new Error("Viewer file path is not allowed.");
  }

  const absoluteRoot = resolve(rootDir);
  const absoluteTarget = resolve(join(rootDir, ...normalizedInput.split("/")));
  const relative = normalize(absoluteTarget).slice(normalize(absoluteRoot).length);
  if (!absoluteTarget.startsWith(`${absoluteRoot}${sep}`) && absoluteTarget !== absoluteRoot) {
    throw new Error("Viewer file path is not allowed.");
  }
  if (relative.includes(`..${sep}`)) {
    throw new Error("Viewer file path is not allowed.");
  }
  return absoluteTarget;
}

function isAllowedRelativePath(path: string): boolean {
  if (path === "README.md" || path === "garden_program.md") {
    return true;
  }
  return ALLOWED_ROOTS.some((root) => path.startsWith(`${root}/`));
}
