import { resolve } from "node:path";

/**
 * Resolves a relative path to an absolute path relative to the project root.
 * If the path is already absolute, it is returned as-is.
 */
export const resolvePath = (relativePath: string): string => {
	if (relativePath.startsWith("/")) {
		return relativePath;
	}
	const projectRoot = resolve(import.meta.dir, "../..");
	return resolve(projectRoot, relativePath);
};
