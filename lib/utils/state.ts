import { config } from "@/config.ts";
import { type State, StateSchema } from "@/lib/db/schema.ts";
import { resolvePath } from "./path.ts";
import { cleanValue, createStorage } from "./storage.ts";

const STATE_FILE = Bun.file(resolvePath(config.stateFile));

// Default values to omit from YAML
const DEFAULTS = {
	keyResult: {
		status: "not_started",
	},
	objective: {
		status: "active",
		keyResults: [],
		refNotes: [],
	},
	idea: {
		status: "raw",
		tags: [],
		refNotes: [],
	},
	settings: {
		currency: config.defaultCurrency,
	},
};

// Custom serializer that omits defaults, empty arrays, undefined, and null values
function serializeState(state: State): unknown {
	const cleaned = {
		version: state.version,
		data: {
			goals: state.data.goals.map((goal) => {
				const cleanedGoal = cleanValue(goal, DEFAULTS.objective) as Record<
					string,
					unknown
				>;
				if (cleanedGoal.keyResults) {
					cleanedGoal.keyResults = (cleanedGoal.keyResults as unknown[]).map(
						(kr) => cleanValue(kr, DEFAULTS.keyResult),
					);
				}
				return cleanedGoal;
			}),
			ideas: state.data.ideas.map((idea) => cleanValue(idea, DEFAULTS.idea)),
			settings: state.data.settings
				? cleanValue(state.data.settings, DEFAULTS.settings)
				: undefined,
		},
	};

	// Remove empty arrays
	if (Array.isArray(cleaned.data.goals) && cleaned.data.goals.length === 0) {
		delete (cleaned.data as Record<string, unknown>).goals;
	}
	if (Array.isArray(cleaned.data.ideas) && cleaned.data.ideas.length === 0) {
		delete (cleaned.data as Record<string, unknown>).ideas;
	}

	return cleaned;
}

const defaultState: State = {
	version: "1.0.0",
	data: {
		goals: [],
		ideas: [],
		settings: {
			currency: config.defaultCurrency,
		},
	},
};

const stateStorage = createStorage({
	file: STATE_FILE,
	schema: StateSchema,
	defaultValue: defaultState,
	defaults: DEFAULTS,
	serialize: serializeState,
});

export const getState = stateStorage.get;
export const saveState = stateStorage.save;
export const updateState = stateStorage.update;
