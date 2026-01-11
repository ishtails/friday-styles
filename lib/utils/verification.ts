import type { VerificationResult } from "./respond.ts";

export const verify = {
	fileWrite: async (
		path: string,
		expectedContent?: Record<string, unknown>,
	): Promise<VerificationResult> => {
		const file = Bun.file(path);
		const exists = await file.exists();

		if (!exists) {
			return {
				paramsValidated: true,
				actionExecuted: false,
				resultVerified: false,
				warnings: [`File not found: ${path}`],
			};
		}

		if (!expectedContent) {
			return {
				paramsValidated: true,
				actionExecuted: true,
				resultVerified: true,
			};
		}

		try {
			const content = await file.text();
			const parsed = JSON.parse(content);

			const matches = Object.entries(expectedContent).every(([key, value]) => {
				return parsed[key] === value;
			});

			return {
				paramsValidated: true,
				actionExecuted: true,
				resultVerified: matches,
				verificationData: matches
					? undefined
					: { expected: expectedContent, actual: parsed },
				warnings: matches
					? undefined
					: ["File content does not match expected values"],
			};
		} catch {
			return {
				paramsValidated: true,
				actionExecuted: true,
				resultVerified: false,
				warnings: ["Failed to parse file for verification"],
			};
		}
	},

	stateUpdate: async <T>(
		verificationFn: () => Promise<T>,
		expectedChanges?: Partial<T>,
	): Promise<VerificationResult & { verificationData?: T }> => {
		try {
			const result = await verificationFn();

			if (!expectedChanges) {
				return {
					paramsValidated: true,
					actionExecuted: true,
					resultVerified: true,
					verificationData: result,
				};
			}

			const matches = Object.entries(expectedChanges).every(([key, value]) => {
				return (result as Record<string, unknown>)[key] === value;
			});

			return {
				paramsValidated: true,
				actionExecuted: true,
				resultVerified: matches,
				verificationData: result,
				warnings: matches
					? undefined
					: ["State changes do not match expected values"],
			};
		} catch (error) {
			return {
				paramsValidated: true,
				actionExecuted: false,
				resultVerified: false,
				warnings: [
					error instanceof Error ? error.message : "Verification failed",
				],
			};
		}
	},

	apiResponse: <T extends Record<string, unknown>>(
		response: T,
		expectedFields?: string[],
	): VerificationResult => {
		if (!expectedFields || expectedFields.length === 0) {
			return {
				paramsValidated: true,
				actionExecuted: true,
				resultVerified: true,
			};
		}

		const missing = expectedFields.filter((field) => !(field in response));

		return {
			paramsValidated: true,
			actionExecuted: true,
			resultVerified: missing.length === 0,
			verificationData:
				missing.length > 0 ? { missingFields: missing } : undefined,
			warnings:
				missing.length > 0
					? [`Missing expected fields: ${missing.join(", ")}`]
					: undefined,
		};
	},
};
