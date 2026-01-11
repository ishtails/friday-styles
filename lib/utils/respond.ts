import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./logger.ts";

export type VerificationResult = {
	paramsValidated: boolean;
	actionExecuted: boolean;
	resultVerified: boolean;
	verificationData?: unknown;
	warnings?: string[];
};

type RespondOptions = {
	toolName?: string;
	params?: unknown;
	verification?: VerificationResult;
};

export const respond = {
	ok: async <T extends Record<string, unknown>>(
		data: T,
		message: string,
		options?: RespondOptions,
	): Promise<CallToolResult> => {
		const response = {
			success: true,
			data,
			message,
			timestamp: new Date().toISOString(),
			...(options?.verification && { verification: options.verification }),
		};

		if (options?.toolName) {
			await log(
				"info",
				options.toolName,
				options.params || {},
				message +
					(options.verification
						? ` [verified: ${options.verification.resultVerified}]`
						: ""),
			);
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(response, null, 2),
				},
			],
		};
	},

	err: async (
		error: string | Error,
		options?: Omit<RespondOptions, "verification">,
	): Promise<CallToolResult> => {
		const errorMsg = error instanceof Error ? error.message : error;
		const response = {
			success: false,
			error: errorMsg,
			timestamp: new Date().toISOString(),
		};

		if (options?.toolName) {
			await log("error", options.toolName, options.params || {}, errorMsg);
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(response, null, 2),
				},
			],
			isError: true,
		};
	},
};
