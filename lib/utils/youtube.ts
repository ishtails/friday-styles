/**
 * Check if yt-dlp is available, either system-wide or via bunx
 */
export async function checkYtDlpAvailable(): Promise<{
	available: boolean;
	useBunx: boolean;
}> {
	try {
		await Bun.$`which yt-dlp`.quiet();
		return { available: true, useBunx: false };
	} catch {
		try {
			await Bun.$`bunx yt-dlp --version`.quiet();
			return { available: true, useBunx: true };
		} catch {
			return { available: false, useBunx: false };
		}
	}
}

/**
 * Build yt-dlp command arguments based on parameters
 */
export function buildYtDlpArgs(
	url: string,
	format: "video" | "audio" | "both",
	quality: string,
	outputTemplate: string,
	audioFormat?: string,
): string[] {
	const args: string[] = [];

	// Format selection
	if (format === "audio") {
		args.push("-x"); // Extract audio
		if (audioFormat) {
			args.push("--audio-format", audioFormat);
		} else {
			args.push("--audio-format", "mp3");
		}
	} else if (format === "video") {
		// Quality selection for video - always prefer MP4 in highest quality
		if (quality === "best") {
			// Prefer MP4 format: best MP4 video + best MP4/M4A audio, fallback to best MP4, then best overall
			args.push(
				"-f",
				"bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best",
			);
			// Ensure merged output is MP4
			args.push("--merge-output-format", "mp4");
		} else if (quality === "worst") {
			args.push("-f", "worst");
		} else {
			args.push("-f", quality);
		}
	} else {
		// "both" - download best available, prefer MP4
		args.push(
			"-f",
			"bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best",
		);
		args.push("--merge-output-format", "mp4");
	}

	// Output template
	args.push("-o", outputTemplate);

	// Add URL
	args.push(url);

	return args;
}
