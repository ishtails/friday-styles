/**
 * Generate a unique ID for an item based on a prefix and existing items.
 * IDs follow the pattern: {prefix}{counter} where counter starts at 1.
 *
 * @param prefix - Single character prefix (e.g., 'g' for goals, 'i' for ideas)
 * @param existingItems - Array of existing items with id property
 * @returns A new unique ID string
 */
export function generateId(
	prefix: string,
	existingItems: Array<{ id: string }>,
): string {
	// Extract numeric suffixes from existing IDs with the same prefix
	const existingNumbers = existingItems
		.map((item) => {
			const match = item.id.match(new RegExp(`^${prefix}(\\d+)$`));
			return match?.[1] ? parseInt(match[1], 10) : 0;
		})
		.filter((num) => num > 0);

	// Find the next available number
	const nextNumber =
		existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

	return `${prefix}${nextNumber}`;
}
