export function parseLocalTime(input: string, timezone: string): Date {
	const trimmed = input.trim();
	const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2})-(\d{2})$/);

	if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) {
		throw new Error(
			`Invalid time format: "${input}". Must be in format "DD-MM-YYYY HH-MM" (e.g., "01-01-2024 14-00")`,
		);
	}

	const day = parseInt(match[1], 10);
	const month = parseInt(match[2], 10) - 1;
	const year = parseInt(match[3], 10);
	const hours = parseInt(match[4], 10);
	const minutes = parseInt(match[5], 10);

	return convertLocalTimeToUTC(year, month, day, hours, minutes, timezone);
}

function convertLocalTimeToUTC(
	year: number,
	month: number,
	day: number,
	hours: number,
	minutes: number,
	timezone: string,
): Date {
	// Create a formatter for the target timezone
	// Using 'en-CA' locale gives us YYYY-MM-DD HH:MM:SS format
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	// Target values we're looking for
	const targetYear = year;
	const targetMonth = month + 1;
	const targetDay = day;
	const targetHours = hours;
	const targetMinutes = minutes;

	// Start searching from noon UTC on the target date
	// This ensures we're in the right day regardless of timezone
	const baseDate = new Date(Date.UTC(year, month, day, 12, 0, 0));

	// Search within ±15 hours to account for all possible timezone offsets
	// (most extreme is UTC+14 and UTC-12, but we'll use ±15 for safety)
	const minOffset = -15 * 60 * 60 * 1000; // -15 hours
	const maxOffset = 15 * 60 * 60 * 1000; // +15 hours
	const step = 60 * 1000; // 1 minute steps for precision

	for (let offset = minOffset; offset <= maxOffset; offset += step) {
		const candidate = new Date(baseDate.getTime() + offset);

		// Use formatToParts for more reliable comparison
		const parts = formatter.formatToParts(candidate);
		const partMap = new Map(parts.map((p) => [p.type, p.value]));

		const candidateYear = parseInt(partMap.get("year") || "0", 10);
		const candidateMonth = parseInt(partMap.get("month") || "0", 10);
		const candidateDay = parseInt(partMap.get("day") || "0", 10);
		const candidateHours = parseInt(partMap.get("hour") || "0", 10);
		const candidateMinutes = parseInt(partMap.get("minute") || "0", 10);

		if (
			candidateYear === targetYear &&
			candidateMonth === targetMonth &&
			candidateDay === targetDay &&
			candidateHours === targetHours &&
			candidateMinutes === targetMinutes
		) {
			return candidate;
		}
	}

	// If we still haven't found it, the timezone might be invalid or there's an edge case
	// Let's verify the timezone is valid by trying to format a known date
	try {
		const testDate = new Date();
		const testFormatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
		});
		testFormatter.format(testDate);
	} catch {
		throw new Error(
			`Invalid timezone identifier: ${timezone}. Please use a valid IANA timezone name (e.g., "Asia/Kolkata", "America/New_York").`,
		);
	}

	throw new Error(
		`Failed to convert local time ${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} to UTC for timezone ${timezone}. This may indicate an invalid date/time combination.`,
	);
}

export function parseDuration(input: string): number {
	const trimmed = input.trim().toLowerCase();
	const hourMatch = trimmed.match(/^(\d+)\s*h(?:ours?)?$/);
	if (hourMatch?.[1]) {
		return parseInt(hourMatch[1], 10) * 60;
	}
	const minuteMatch = trimmed.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/);
	if (minuteMatch?.[1]) {
		return parseInt(minuteMatch[1], 10);
	}
	throw new Error(
		`Invalid duration format: "${input}". Use formats like "1h", "90m"`,
	);
}

export function convertToGoogleCalendarFormat(
	date: Date,
	timezone: string,
): { dateTime: string; timeZone: string } {
	return {
		dateTime: date.toISOString(),
		timeZone: timezone,
	};
}

export function validateEventTimes(startTime: Date, endTime: Date): void {
	if (endTime <= startTime) {
		throw new Error(
			`End time (${endTime.toISOString()}) must be after start time (${startTime.toISOString()})`,
		);
	}
}

export function validateNotInPast(
	date: Date,
	bufferMinutes: number = 60,
): void {
	const now = new Date();
	const bufferTime = new Date(now.getTime() - bufferMinutes * 60 * 1000);

	if (date < bufferTime) {
		throw new Error(
			`Cannot schedule events in the past. Time ${date.toISOString()} is before current time (${now.toISOString()})`,
		);
	}
}
