import { config } from "@/config.ts";
import {
	type Profile,
	type ProfileItem,
	ProfileSchema,
} from "@/lib/db/schema.ts";
import { resolvePath } from "./path.ts";
import { cleanValue, createStorage } from "./storage.ts";

const PROFILE_FILE = Bun.file(resolvePath(config.profileFile));

// Default values to omit from YAML
const DEFAULTS = {
	profileItem: {
		tags: [],
	},
};

// Custom serializer that omits defaults, empty arrays, undefined, and null values
function serializeProfile(profile: Profile): unknown {
	const cleaned = {
		version: profile.version,
		items: profile.items.map((item) => cleanValue(item, DEFAULTS.profileItem)),
	};

	// Remove empty arrays
	if (Array.isArray(cleaned.items) && cleaned.items.length === 0) {
		delete (cleaned as Record<string, unknown>).items;
	}

	return cleaned;
}

const defaultProfile: Profile = {
	version: "1.0.0",
	items: [],
};

const profileStorage = createStorage({
	file: PROFILE_FILE,
	schema: ProfileSchema,
	defaultValue: defaultProfile,
	defaults: DEFAULTS,
	serialize: serializeProfile,
});

export const getProfile = profileStorage.get;
export const saveProfile = profileStorage.save;
export const updateProfile = profileStorage.update;

// Helper functions
export const getItemsByCategory = async (
	category: string,
): Promise<ProfileItem[]> => {
	const profile = await getProfile();
	return profile.items.filter((item) => item.category === category);
};

export const addItem = async (item: ProfileItem): Promise<Profile> => {
	const profile = await getProfile();
	const updatedItems = [...profile.items, item];
	return await updateProfile({ items: updatedItems });
};

export const updateItem = async (
	itemId: string,
	updates: Partial<ProfileItem>,
): Promise<Profile> => {
	const profile = await getProfile();
	const itemIndex = profile.items.findIndex((item) => item.id === itemId);
	if (itemIndex < 0) {
		throw new Error(`Item with ID ${itemId} not found`);
	}
	const existingItem = profile.items[itemIndex];
	if (!existingItem) {
		throw new Error(`Item with ID ${itemId} not found`);
	}
	const updatedItems = [...profile.items];
	updatedItems[itemIndex] = {
		...existingItem,
		...updates,
		updatedAt: Date.now(),
	};
	return await updateProfile({ items: updatedItems });
};

export const deleteItem = async (itemId: string): Promise<Profile> => {
	const profile = await getProfile();
	const updatedItems = profile.items.filter((item) => item.id !== itemId);
	return await updateProfile({ items: updatedItems });
};
