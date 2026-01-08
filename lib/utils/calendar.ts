import { type calendar_v3, google } from "googleapis";
import { config } from "@/config.ts";
import {
	convertToGoogleCalendarFormat,
	parseDuration,
	parseLocalTime,
	validateEventTimes,
	validateNotInPast,
} from "./datetime.ts";
import { getAuthenticatedClient } from "./google-auth.ts";

export async function getCalendarClient() {
	return google.calendar({
		version: "v3",
		auth: await getAuthenticatedClient(),
	});
}

export interface CreateEventParams {
	title: string;
	description?: string;
	startTime: string;
	endTime?: string;
	timezone?: string;
}

export interface CreateEventResult {
	id?: string;
	htmlLink?: string;
	event: calendar_v3.Schema$Event;
}

export async function createEvent(
	params: CreateEventParams,
): Promise<CreateEventResult> {
	const tz = params.timezone || config.timezone;
	const startDate = parseLocalTime(params.startTime, tz);
	validateNotInPast(startDate);

	let endDate: Date;
	if (params.endTime) {
		try {
			const durationMinutes = parseDuration(params.endTime);
			endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
		} catch {
			endDate = parseLocalTime(params.endTime, tz);
		}
	} else {
		endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
	}

	validateEventTimes(startDate, endDate);

	const calendar = await getCalendarClient();
	const event = await calendar.events.insert({
		calendarId: "primary",
		requestBody: {
			summary: params.title,
			description: params.description || "",
			start: convertToGoogleCalendarFormat(startDate, tz),
			end: convertToGoogleCalendarFormat(endDate, tz),
		},
	});

	return {
		id: event.data.id || undefined,
		htmlLink: event.data.htmlLink || undefined,
		event: event.data,
	};
}

export async function getEvent(
	eventId: string,
): Promise<calendar_v3.Schema$Event> {
	const calendar = await getCalendarClient();
	const event = await calendar.events.get({
		calendarId: "primary",
		eventId,
	});
	return event.data;
}

export interface UpdateEventParams {
	eventId: string;
	title?: string;
	description?: string;
	startTime?: string;
	endTime?: string;
	timezone?: string;
}

export async function updateEvent(
	params: UpdateEventParams,
): Promise<CreateEventResult> {
	const calendar = await getCalendarClient();
	const tz = params.timezone || config.timezone;

	const existingEvent = await calendar.events.get({
		calendarId: "primary",
		eventId: params.eventId,
	});

	const updateData: {
		summary?: string;
		description?: string;
		start?: { dateTime: string; timeZone: string };
		end?: { dateTime: string; timeZone: string };
	} = {};

	if (params.title !== undefined) updateData.summary = params.title;
	if (params.description !== undefined)
		updateData.description = params.description;

	let startDate: Date | undefined;
	let endDate: Date | undefined;

	if (params.startTime) {
		startDate = parseLocalTime(params.startTime, tz);
		validateNotInPast(startDate);
		updateData.start = convertToGoogleCalendarFormat(startDate, tz);
	} else if (existingEvent.data.start?.dateTime) {
		startDate = new Date(existingEvent.data.start.dateTime);
	}

	if (params.endTime) {
		if (startDate) {
			try {
				const durationMinutes = parseDuration(params.endTime);
				endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
			} catch {
				endDate = parseLocalTime(params.endTime, tz);
			}
		} else {
			endDate = parseLocalTime(params.endTime, tz);
		}
		updateData.end = convertToGoogleCalendarFormat(endDate, tz);
	} else if (existingEvent.data.end?.dateTime) {
		endDate = new Date(existingEvent.data.end.dateTime);
	}

	if (startDate && endDate) {
		validateEventTimes(startDate, endDate);
	}

	const event = await calendar.events.update({
		calendarId: "primary",
		eventId: params.eventId,
		requestBody: updateData,
	});

	return {
		id: event.data.id || undefined,
		htmlLink: event.data.htmlLink || undefined,
		event: event.data,
	};
}

export interface DeleteEventParams {
	eventId: string;
	sendUpdates?: "all" | "externalOnly" | "none";
}

export interface DeleteEventResult {
	isRecurring: boolean;
	isRecurringMaster: boolean;
}

export async function deleteEvent(
	params: DeleteEventParams,
): Promise<DeleteEventResult> {
	const calendar = await getCalendarClient();

	const existingEvent = await calendar.events.get({
		calendarId: "primary",
		eventId: params.eventId,
	});

	const isRecurring = !!existingEvent.data.recurringEventId;
	const isRecurringMaster = !!existingEvent.data.recurrence;

	await calendar.events.delete({
		calendarId: "primary",
		eventId: params.eventId,
		sendUpdates: params.sendUpdates || "none",
	});

	return { isRecurring, isRecurringMaster };
}

export interface ListEventsParams {
	days?: number;
	maxResults?: number;
}

export async function listEvents(
	params: ListEventsParams = {},
): Promise<calendar_v3.Schema$Event[]> {
	const calendar = await getCalendarClient();
	const days = params.days ?? 30;
	const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();

	const response = await calendar.events.list({
		calendarId: "primary",
		timeMin: new Date().toISOString(),
		timeMax,
		singleEvents: true,
		orderBy: "startTime",
		maxResults: params.maxResults ?? 50,
	});

	return response.data.items || [];
}

export type Event = calendar_v3.Schema$Event;
