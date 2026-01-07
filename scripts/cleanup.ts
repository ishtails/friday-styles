import { cleanupState } from "@/lib/utils/cleanup.ts";

await cleanupState({
	preset: "aggressive",
});

console.log("Cleanup complete");
