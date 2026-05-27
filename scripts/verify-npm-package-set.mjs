import { readFileSync } from "node:fs";
import { join } from "node:path";

const packages = [
	["packages/design-embed", "design-embed", false],
	["packages/plugin-figma-html", "@design-embed/plugin-figma-html", false],
	["packages/target-react", "@design-embed/target-react", false],
	["packages/core", "@design-embed/core", true],
	["packages/config", "@design-embed/config", true],
];

const errors = [];

for (const [directory, expectedName, expectedPrivate] of packages) {
	const packageJson = JSON.parse(
		readFileSync(join(directory, "package.json"), "utf8"),
	);

	if (packageJson.name !== expectedName) {
		errors.push(`${directory} must be named ${expectedName}.`);
	}

	if (Boolean(packageJson.private) !== expectedPrivate) {
		errors.push(
			`${expectedName} must have private: ${String(expectedPrivate)}.`,
		);
	}

	if (!expectedPrivate && packageJson.publishConfig?.access !== "public") {
		errors.push(`${expectedName} must publish with public access.`);
	}

	for (const [dependencyName, specifier] of Object.entries(
		packageJson.dependencies ?? {},
	)) {
		if (
			specifier === "workspace:*" &&
			["@design-embed/config", "@design-embed/core"].includes(dependencyName) &&
			!packageJson.bundledDependencies?.includes(dependencyName)
		) {
			errors.push(
				`${expectedName} must bundle private dependency ${dependencyName}.`,
			);
		}
	}
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log("npm package set is valid.");
